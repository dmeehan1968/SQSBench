import { Duration, Stack } from "aws-cdk-lib"
import { Construct } from "constructs"
import { SqsTest } from "@/infra/SqsTest/SqsTest"
import { Dashboard, GraphWidget, MathExpression, PeriodOverride } from "aws-cdk-lib/aws-cloudwatch"
import { Fqn } from "@/Fqn"
import { Statistic } from "@aws-sdk/client-cloudwatch"
import { toExprName } from "@/infra"

export class SqsTestDashboard extends Stack {
  constructor(scope: Construct, id: string, { tests }: { tests: SqsTest[] }) {
    super(scope, id)

    const dashboard = new Dashboard(this, 'SqsTestDashboard', {
      dashboardName: Fqn(this),
      defaultInterval: Duration.hours(12),
      periodOverride: PeriodOverride.INHERIT,
    })

    const period = Duration.minutes(1)

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
        left: tests.map(test => {
          const cost = Fqn(test, { suffix: 'Cost', transform: toExprName })
          return new MathExpression({
            label: [Fqn(test, { allowedSpecialCharacters: '-' }), 'Cost Per Month ($)'].join(' '),
            expression: `${cost} / 75 * 100 * 24 * 30`,
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
              expression: `${rate} / 75 * 100 / 60`,
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
        left: tests.map(test => test.metricConsumerCost({ period })),
        right: [
          // use the first test queue as a proxy for the producer
          tests[0].queue.metricNumberOfMessagesSent({ period, label: 'Message Rate', statistic: Statistic.Sum }),
        ],
        period,
      }),
      new GraphWidget({
        title: 'Cost Per Message',
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
        left: tests.map(test => test.queue.metricApproximateNumberOfMessagesVisible({
          period,
          statistic: Statistic.Maximum,
        })),
        period,
      }),
      new GraphWidget({
        title: 'Age of Oldest Messages',
        left: tests.map(test => test.queue.metricApproximateAgeOfOldestMessage({
          period,
          statistic: Statistic.Maximum,
        })),
        period,
      }),
      new GraphWidget({
        title: 'Receives',
        left: tests.map(test => test.queue.metricNumberOfMessagesReceived({
          period,
          statistic: Statistic.SampleCount,
        })),
      }),
      new GraphWidget({
        title: 'Empty Receives',
        left: tests.map(test => test.queue.metricNumberOfEmptyReceives({
          period,
          statistic: Statistic.Sum,
        })),
        period,
      }),
      new GraphWidget({
        title: 'Batch Size',
        left: tests.map(test => test.metricConsumerBatchSize({ period })),
        period,
      }),
    )
  }
}