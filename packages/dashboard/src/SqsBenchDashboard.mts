import { Duration } from "aws-cdk-lib"
import { Construct } from "constructs"
import { SqsTest } from "@sqsbench/benchmark"
import { Dashboard, GraphWidget, IMetric, MathExpression, Metric, PeriodOverride } from "aws-cdk-lib/aws-cloudwatch"
import { Fqn } from "@sqsbench/constructs"
import { toExprName } from "@sqsbench/helpers"
import { Statistic } from "@aws-sdk/client-cloudwatch"

interface Props {
  tests: SqsTest[]
  dutyCyclePerHour: number
}

export class SqsBenchDashboard extends Construct {
  constructor(scope: Construct, id: string, { tests, dutyCyclePerHour }: Props) {
    super(scope, id)

    const dashboard = new Dashboard(this, 'SqsTestDashboard', {
      dashboardName: Fqn(this),
      defaultInterval: Duration.hours(12),
      periodOverride: PeriodOverride.INHERIT,
    })

    const period = Duration.minutes(1)
    const width = 8
    const height = undefined

    // apparent message rate is only available if high-res metrics are enabled
    const testsWithHighRes = tests.filter(test => test.highResMetricsEnabled)
    let apparentMessageRateTitle = `Weighted Message Rate - ${testsWithHighRes.length ? 'High-Res' : 'Standard-Res Only' }`
    let apparentMessageRateMetric: IMetric | undefined
    apparentMessageRateMetric = tests
      .slice(0, 1)    // only use the first one
      .map(test => test.metricConsumerMessagesReceived({ label: 'Messages Received', period: Duration.seconds(1), statistic: Statistic.Sum }))
      .shift()

    // if there are no high-res metrics, add a placeholder so the widget is still valid.
    if (!apparentMessageRateMetric) {
      apparentMessageRateTitle += ' (Not Enabled)'
      apparentMessageRateMetric = new Metric({
        metricName: 'HighResMetricPlaceholder',
        namespace: 'HighResMetricPlaceholder',
        dimensionsMap: {},
        period,
        statistic: Statistic.Sum,
      })
    }

    dashboard.addWidgets(
      new GraphWidget({
        title: 'Total Cost Per Period',
        width: 24,
        height: 16,
        left: tests.map(test => test.metricTotalCost({ period })),
        right: [
          // use the first test queue as a proxy for the producer
          tests[0].queue.metricNumberOfMessagesSent({ period, label: 'Message Rate', statistic: Statistic.Sum }),
        ],
        period,
      }),
      new GraphWidget({
        title: 'Total Cost Per Month',
        width,
        height,
        left: tests.map(test => {
          const cost = Fqn(test, { suffix: 'Cost', transform: toExprName })
          return new MathExpression({
            label: [Fqn(test, { allowedSpecialCharacters: '-' }), 'Cost Per Month ($)'].join(' '),
            expression: `${cost} / ${dutyCyclePerHour} * 24 * 30`,
            usingMetrics: {
              [cost]: test.metricTotalCost({ period }),
            },
          })
        }),
        right: [
          (() => {
            const test = tests[0]
            const rate = Fqn(test, { suffix: 'Rate', transform: toExprName })
            return new MathExpression({
              label: 'Messages Rate (minute)',
              expression: `${rate} / ${dutyCyclePerHour} / 60`,
              usingMetrics: {
                [rate]: test.queue.metricNumberOfMessagesSent({
                  period: Duration.hours(1),
                  label: 'Message Rate',
                  statistic: Statistic.Sum,
                }),
              },
            })
          })(),
        ],
        period: Duration.hours(1),
      }),
      new GraphWidget({
        title: 'Cost of Consumer',
        width,
        height,
        left: tests.map(test => test.metricConsumerCost({ period })),
        right: [
          // use the first test queue as a proxy for the producer
          tests[0].queue.metricNumberOfMessagesSent({ period, label: 'Message Rate', statistic: Statistic.Sum }),
        ],
        period,
      }),
      new GraphWidget({
        title: 'Cost Per Message',
        width,
        height,
        left: tests.map(test => {
          const cost = Fqn(test, { suffix: 'CPMCost', transform: toExprName })
          const receives = Fqn(test, { suffix: 'CPMReceives', transform: toExprName })
          return new MathExpression({
            label: Fqn(test, { allowedSpecialCharacters: '-' }) + ' Cost Per Message',
            expression: `${cost} / FILL(${receives},0)`,
            usingMetrics: {
              [cost]: test.metricTotalCost({ period }),
              [receives]: test.queue.metricNumberOfMessagesReceived({ period, statistic: Statistic.Sum }),
            },
          })
        }),
        right: [
          // use the first test queue as a proxy for the producer
          tests[0].queue.metricNumberOfMessagesSent({ period, label: 'Message Rate', statistic: Statistic.Sum }),
        ],
        period,
      }),
      new GraphWidget({
        title: 'Approximate Number of Visible Messages',
        width,
        height,
        left: tests.map(test => test.queue.metricApproximateNumberOfMessagesVisible({
          period,
          statistic: Statistic.Maximum,
        })),
        period,
      }),
      new GraphWidget({
        title: 'Approximate Age of Oldest Messages',
        width,
        height,
        left: tests.map(test => test.queue.metricApproximateAgeOfOldestMessage({
          period,
          statistic: Statistic.Maximum,
        })),
        period,
      }),
      new GraphWidget({
        title: 'Delivery Latency',
        width,
        height,
        left: tests.map(test => test.metricConsumerLatency({
          period,
          statistic: Statistic.Average,
        })),
        period,
      }),
      new GraphWidget({
        title: 'Receive Message Requests',
        width,
        height,
        left: tests.map(test => test.queue.metricNumberOfMessagesReceived({
          period,
          statistic: Statistic.SampleCount,
        })),
      }),
      new GraphWidget({
        title: 'Empty Receives',
        width,
        height,
        left: tests.map(test => test.queue.metricNumberOfEmptyReceives({
          period,
          statistic: Statistic.Sum,
        })),
        period,
      }),
      new GraphWidget({
        title: 'Average Messages Received at Consumer',
        width,
        height,
        left: tests.map(test => test.metricConsumerMessagesReceived({ period })),
        period,
      }),
      new GraphWidget({
        title: apparentMessageRateTitle,
        width,
        height,
        left: [apparentMessageRateMetric],
        period,
      }),
    )
  }
}