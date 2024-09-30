import { Duration } from "aws-cdk-lib"
import { MathExpression, Unit } from "aws-cdk-lib/aws-cloudwatch"
import { Statistic } from "@aws-sdk/client-cloudwatch"
import { toExprName } from "@sqsbench/helpers"
import { NodejsFunction } from './NodejsFunction.mjs'
import { Fqn } from './Fqn.mjs'

interface LambdaCostMetricProps {
  label?: string
  period?: Duration
  statistic?: Statistic
}

export class LambdaCostMetric extends MathExpression {
  constructor(fn: NodejsFunction, { period = Duration.minutes(1), label = 'Cost', statistic = Statistic.Sum }: LambdaCostMetricProps = {}) {
    const consumerInvocations = Fqn(fn, { suffix: 'Invocations', transform: toExprName })
    const consumerDuration = Fqn(fn, { suffix: 'Duration', transform: toExprName })
    super({
      label: [Fqn(fn, { allowedSpecialCharacters: '-' }), label].join(' '),
      expression: `(${consumerInvocations} * (0.20 / 1000000)) + (${consumerDuration}/1000*(${fn.memorySize}/1024) * 0.0000166667)`,
      usingMetrics: {
        [consumerInvocations]: fn.metricInvocations({ period, statistic, unit: Unit.COUNT }),
        [consumerDuration]: fn.metricDuration({ period, statistic, unit: Unit.MILLISECONDS }),
      },
    })
  }
}