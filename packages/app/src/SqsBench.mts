import { Duration, Stack, Tags } from "aws-cdk-lib"
import { Construct } from "constructs"
import { SqsProducer } from "@sqsbench/producer"
import { SqsTest, SqsTestProps } from "@sqsbench/benchmark"
import { SqsBenchDashboard } from "@sqsbench/dashboard"
import { clamp } from "@sqsbench/helpers"

/**
 * The props for the SqsBench stack.
 */

interface Props {
  /**
   * A definition of the tests to run.
   */
  tests: SqsTestProps[]

  /**
   * The minimum rate of messages to send per second.  Must be greater than 0.
   */
  minRate: number

  /**
   * The maximum rate of messages to send per second.  Must be greater than 0.  Ideally should be to the power of 2,
   * e.g. 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096 etc.
   *
   * NB: Any test that uses a maxConcurrency is likely to end up backlogged if the rate exceeds its capacity.
   */
  maxRate: number
  /**
   * Duration of message handling in the consumer, per message. Must be greater than 0.
   *
   * NB: Per Message Duration * Test Batch Size cannot exceed 897 seconds
   */
  consumerPerMessageDuration: Duration

  /**
   * The duty cycle of the rateDurationInMinutes.  Must be between 0 and 1.
   *
   * Messages are sent from the top of the hour until the rateDurationInMinutes * dutyCycle has elapsed,
   * then no messages are sent until the full rateDurationInMinutes has elapsed.
   */
  dutyCycle: number

  /**
   * The duration at which the rate is maintained before changing by the scale factor.  Must be whole minutes
   * greater than 0.  Default is 60 minutes.
   */
  rateDurationInMinutes?: number

  /**
   * The scale factor to apply to the rate when changing.  Must be greater than 0.  Default is 2.
   */
  rateScaleFactor?: number

  /**
   * The distribution of weights to apply to the messages sent.  Must be an array of numbers >= 0
   * (decimals allowed), with at least one element.  The sum of the weights must be non-zero.
   *
   * The minute is split into equal segments relating to each weight. Messages are randomised into those
   * segments according to the proportions expressed by the weights.
   *
   * The purpose is to allow you to provide a degree of busy/quiet time to each minute, rather than an even
   * distribution that might be created by randomisation alone.  Because all tests use the same distribution,
   * you can compare the performance of different configurations.
   *
   * Default is [1, 2, 1] which means that the middle 20 seconds of the minute will receive as many messages
   * as the first and last 20 seconds combined.
   *
   * @example [1] and [1, 1] are equivalent and will send messages randomised across the minute
   * @example [1, 0] will send all messages in the first 30 seconds of the minute
   * @example [0, 1] will send all messages in the last 30 seconds of the minute
   * @example Array.from({ length: 60 }, (_, index) => index === 29 ? 1 : 0) will send all messages in the 30th second
   */

  weightDistribution?: number[]
}

/**
 * A stack that runs a benchmark of SQS tests.
 *
 * When first deployed with at least one enabled test, the producer will wait until the top of the next hour
 * before starting to send messages.  The producer sends the same pattern of messages to each enabled test, so
 * that you can compare the performance of different configurations.  A CloudWatch dashboard is provided with
 * useful comparisons of the tests.
 *
 * If no tests are enabled, the producer will be disabled, but all resources are created so that you can
 * enable and disable them as required.  If the test is enabled but the producer is disabled (or in an idle phase)
 * then no messages will be sent, but the consumers will still incur costs for the resources they use.  This is
 * useful to determine baseline costs for idle queues.
 *
 * ## Backlog and Poller scale back
 *
 * EventBridge Pipes and Event Source Mapping use pollers that are scaled
 * according to demand, and these take time to scale back to defaults when traffic stops.  You can isolate tests
 * by extending the rateDurationInMinutes and setting the dutyCycle to less than 1 to allow the pollers to scale
 * back before the next test starts.  For example, when rateDurationInMinutes is 60 and dutyCycle is 0.75, there
 * will be a 15 minute period during which no messages are sent, allowing the pollers to scale back.  This is
 * usually sufficient up to a rate of 512 messages per minute.  Note that pollers also take time to scale up,
 * so the test needs to be long enough to get a good impression of the maximum number of pollers.  Generally
 * you will want the test to run for 45-60 minutes and to scale down for 15-30 minutes.  Test with constrained
 * concurrency may need longer to recover from backlog.
 *
 * ## Dashboard
 *
 * The dashboard has some widgets that are rounded per hour, or scaled up to months, as a cost estimation/
 * comparison tool.  They rely on the tests having a duty cycle that that is an hour, or fraction of an hour when
 * the rateDurationInMinutes is set to 60.  The active part of the duration will be scaled appropriately, but
 * for example, a test with a rateDurationInMinutes of 120 and a duty cycle of 0.75 will show as the correct hourly
 * rate for the first hour, but will be inaccurate for the second hour.  This is a limitation of the dashboard
 * math expressions.  Try to work with whole hours of activity and whole hours of inactivity so that the metrics
 * fall within whole hour boundaries.  This is why the tests don't start until the top of the next hour.
 *
 * ## Historical Metrics
 *
 * If you remove a test definition from the stack, then the dashboard will not show metrics for that test
 * even if it has already run.  Use the enable property to disable a test whilst retaining the ability to review
 * its history via the Dashboard.
 *
 * Note: CloudWatch standard resolution metrics (>= 1 minute resolution) are retained for up to 15 days, and
 * high resolution metrics (1 second resolution) are retained for 3 hours.
 *
 * ## Producer Parameter
 *
 * The producer maintains a String Parameter in the AWS Parameter Store which is a JSON representation of its
 * current state.  This is used to maintain the rate of messages sent.  You can make direct edits to this whilst
 * tests are in progress (or disabled) to change the rate of messages sent and when the rate will next change. If
 * the value is not a valid JSON object, or has incompatible values for 'rate' and 'rateChangeAt', then the
 * parameter will be reset to the default value (rate 0 until the top of the next hour).  Note that the rateChangeAt
 * value is stored in UTC, not your regions local time.
 *
 * @param {Props} props The properties for the stack
 */
export class SqsBench extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id)

    props.rateDurationInMinutes ??= 60
    props.rateScaleFactor ??= 2

    // add tests
    const tests = props.tests.map(test => new SqsTest(this, {
      ...test,
      perMessageDuration: props.consumerPerMessageDuration
    }))

    // add producer
    new SqsProducer(this, 'Producer', {
      queues: tests.map(test => ({ queue: test.queue, enabled: test.enabled })),
      enabled: tests.reduce((acc, test) => acc || test.enabled, false),
      dutyCycle: props.dutyCycle,
      minRate: props.minRate,
      maxRate: props.maxRate,
      rateDurationInMinutes: props.rateDurationInMinutes,
      rateScaleFactor: props.rateScaleFactor,
      weightDistribution: props.weightDistribution ?? [ 1, 2, 1 ],
    })

    // add dashboard
    new SqsBenchDashboard(this, 'Dashboard', {
      tests,
      dutyCyclePerHour: props.dutyCycle * clamp(props.rateDurationInMinutes / 60, { max: 1 }),
    })

    Tags.of(this).add('AppManagerCFNStackKey', process.env.npm_package_name ?? 'SqsBench')

  }
}