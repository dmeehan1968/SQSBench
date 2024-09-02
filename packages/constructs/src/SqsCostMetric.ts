import { Duration } from "aws-cdk-lib"
import { MathExpression, Unit } from "aws-cdk-lib/aws-cloudwatch"
import { Queue, Fqn } from "packages/constructs/src/index"
import { Statistic } from "@aws-sdk/client-cloudwatch"
import { toExprName } from "../../helpers/src/toExprName"

interface SqsCostMetricProps {
  period?: Duration
  label?: string
}

export class SqsCostMetric extends MathExpression {
  constructor(queue: Queue, { period = Duration.minutes(1), label = 'SQS Cost' }: SqsCostMetricProps) {

    const receives = Fqn(queue, { suffix: 'Receives', transform: toExprName })
    const emptyReceives = Fqn(queue, { suffix: 'EmptyReceives', transform: toExprName })
    const deletions = Fqn(queue, { suffix: 'Deletions', transform: toExprName })

    super({
      label: [Fqn(queue, { allowedSpecialCharacters: '-' }), label].join(' '),
      expression: `(${receives} + ${emptyReceives} + ${deletions}) * (0.40 / 1000000)`,
      usingMetrics: {
        [receives]: queue.metricNumberOfMessagesReceived({
          period,
          statistic: Statistic.SampleCount,
          unit: Unit.COUNT,
        }),
        [emptyReceives]: queue.metricNumberOfEmptyReceives({
          period,
          statistic: Statistic.Sum,
          unit: Unit.COUNT
        }),
        [deletions]: queue.metricNumberOfMessagesDeleted({
          period,
          statistic: Statistic.SampleCount,
          unit: Unit.COUNT,
        }),
      },
    })

  }

}