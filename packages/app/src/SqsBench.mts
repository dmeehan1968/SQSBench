import { Duration, Stack, Tags } from "aws-cdk-lib"
import { Construct } from "constructs"
import { SqsProducer } from "@sqsbench/producer"
import { SqsTest, SqsTestProps } from "@sqsbench/benchmark"
import { SqsBenchDashboard } from "@sqsbench/dashboard"

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
   * The duty cycle of the producer.  Must be between 0 and 1.
   */

  dutyCycle: number
}

export class SqsBench extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id)

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
    })

    // add dashboard
    new SqsBenchDashboard(this, 'Dashboard', {
      tests,
    })

    Tags.of(this).add('AppManagerCFNStackKey', process.env.npm_package_name ?? 'SqsBench')

  }
}