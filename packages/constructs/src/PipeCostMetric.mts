import { MathExpression, Metric } from "aws-cdk-lib/aws-cloudwatch"
import { Pipe } from "@aws-cdk/aws-pipes-alpha"
import { Duration } from "aws-cdk-lib"
import { Statistic } from "@aws-sdk/client-cloudwatch"
import { Fqn } from "./Fqn.mjs"
import { toExprName } from "@sqsbench/helpers"

/**
 * The cost of an EventBridge Pipe
 *
 * Pipe pricing isn't exactly clear, but you are charged for events up to 64KB in size, with each 64KB chunk
 * representing another 'event'.  There is an 'EventCount' metric which I think represents the unfiltered
 * events, but you only pay for events matching the filter, which I think is then represented by the
 * 'Invocations' metric.
 *
 * The cost is $0.40 per million 'requests'.
 *
 * Here we take the total event size for the period, divide by the event count, then divide by 64KB
 * then multiply by the invocations and the cost per million requests.
 */
export class PipeCostMetric extends MathExpression {
  constructor(pipe: Pipe, { period = Duration.minutes(1), label = 'Pipe Cost', statistic = Statistic.Sum }: {
    period?: Duration,
    label?: string,
    statistic?: Statistic
  } = {}) {
    const invocations = Fqn(pipe, { suffix: 'Invocations', transform: toExprName })
    const eventCount = Fqn(pipe, { suffix: 'EventCount', transform: toExprName })
    const eventSize = Fqn(pipe, { suffix: 'EventSize', transform: toExprName })
    const commonOptions = {
      namespace: 'AWS/EventBridge/Pipes',
      dimensionsMap: {
        PipeName: pipe.pipeName,
      },
      statistic,
      period,
    }
    super({
      label: [Fqn(pipe, { allowedSpecialCharacters: '-' }), label].join(' '),
      expression: `CEIL(${eventSize}/${eventCount}/65536) * ${invocations} * (0.40 / 1000000)`,
      usingMetrics: {
        [invocations]: new Metric({ ...commonOptions, metricName: 'Invocations' }),
        [eventSize]: new Metric({ ...commonOptions, metricName: 'EventSize' }),
        [eventCount]: new Metric({ ...commonOptions, metricName: 'EventCount' }),
      },
    })
  }
}