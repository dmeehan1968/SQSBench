import { App, Duration } from "aws-cdk-lib"
import { PollerType } from "@sqsbench/benchmark"
import { SqsBench } from "./SqsBench.mjs"
import { InvocationType } from 'aws-cdk-lib/triggers'

const app = new App()

new SqsBench(app, 'SqsBench', {
  minRate: 3500,
  maxRate: 3500,
  consumerPerMessageDuration: Duration.millis(500),
  dutyCycle: 0.25,
  rateDurationInMinutes: 60,
  rateScaleFactor: 2,
  weightDistribution: [1],  // TODO [1, 2, 1]
  consumerMemory: 128,
  tests: [
    { enabled: false, batchSize: 100, batchWindow: Duration.seconds(1), pollerType: PollerType.Pipe, highResMetrics: false },
    { enabled: false, batchSize: 100, batchWindow: Duration.seconds(1), pollerType: PollerType.EventSource, maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(60), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 5, invocationType: InvocationType.REQUEST_RESPONSE },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(60), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 5, invocationType: InvocationType.EVENT },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(5), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(10), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(20), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(0), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(5), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(10), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.Pipe },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.Pipe },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(0), pollerType: PollerType.EventSource },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource, maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource, maxConcurrency: 5 },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource, maxConcurrency: 5 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource, maxConcurrency: 5 },
  ],
})
export { PollerType }

