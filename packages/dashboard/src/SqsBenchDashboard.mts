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

    // apparent message rate is only available if high res metrics are enabled
    let apparentMessageRateMetric: IMetric | undefined
    apparentMessageRateMetric = tests
      .filter(test => test.supportsHighRes)
      .map(test => test.metricConsumerBatchSize({ label: 'Messages Received', period: Duration.seconds(1), statistic: Statistic.Sum }))
      .shift()

    // if there are no high res metrics, add a placeholder so the widget is still valid.
    if (!apparentMessageRateMetric) {
      apparentMessageRateMetric = new Metric({
        metricName: 'HighResMetricNotConfigured',
        namespace: 'HighResMetricNotConfigured',
        dimensionsMap: {},
        period,
        statistic: Statistic.Sum,
      })
    }

    dashboard.addWidgets(
      new GraphWidget({
        title: 'Test Cost',
        width: 24,
        height: 16,
        left: tests.map(test => test.metricCost({ period })),
        right: [
          // use the first test queue as a proxy for the producer
          tests[0].queue.metricNumberOfMessagesSent({ period, label: 'Message Rate', statistic: Statistic.Sum }),
        ],
        period,
      }),
      new GraphWidget({
        title: 'Test Cost Per Month',
        width,
        height,
        left: tests.map(test => {
          const cost = Fqn(test, { suffix: 'Cost', transform: toExprName })
          return new MathExpression({
            label: [Fqn(test, { allowedSpecialCharacters: '-' }), 'Cost Per Month ($)'].join(' '),
            expression: `${cost} / ${dutyCyclePerHour} * 24 * 30`,
            usingMetrics: {
              [cost]: test.metricCost({ period }),
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
        title: 'Consumer Cost',
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
            expression: `${cost} / ${receives}`,
            usingMetrics: {
              [cost]: test.metricCost({ period }),
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
        title: 'Number of Visible Messages',
        width,
        height,
        left: tests.map(test => test.queue.metricApproximateNumberOfMessagesVisible({
          period,
          statistic: Statistic.Maximum,
        })),
        period,
      }),
      new GraphWidget({
        title: 'Age of Oldest Messages',
        width,
        height,
        left: tests.map(test => test.queue.metricApproximateAgeOfOldestMessage({
          period,
          statistic: Statistic.Maximum,
        })),
        period,
      }),
      new GraphWidget({
        title: 'Receives',
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
        title: 'Batch Size',
        width,
        height,
        left: tests.map(test => test.metricConsumerBatchSize({ period })),
        period,
      }),
      new GraphWidget({
        title: `Apparent Message Rate (${apparentMessageRateMetric instanceof MathExpression ? 'Disabled' : 'High Res'})`,
        width,
        height,
        left: [apparentMessageRateMetric],
        period,
      }),
    )
  }
}