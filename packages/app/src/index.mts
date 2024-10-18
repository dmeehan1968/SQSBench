import { App, Duration } from "aws-cdk-lib"
import { PollerType } from "@sqsbench/benchmark"
import { SqsBench } from "./SqsBench.mjs"
import { InvocationType } from 'aws-cdk-lib/triggers'

const app = new App()

new SqsBench(app, 'SqsBench', {
  minRate: 1,
  maxRate: 4096,
  consumerPerMessageDuration: Duration.millis(50),
  dutyCycle: 1,
  rateDurationInMinutes: 60,
  rateScaleFactor: 2,
  weightDistribution: [1],  // TODO [1, 2, 1]
  consumerMemory: 128,
  tests: [
    { enabled: false, batchSize: 10, batchWindow: Duration.seconds(0), pollerType: PollerType.Pipe, highResMetrics: false },
    { enabled: true, batchSize: 100, batchWindow: Duration.seconds(60), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 5, invocationType: InvocationType.REQUEST_RESPONSE },
    { enabled: false, batchSize: 100, batchWindow: Duration.seconds(60), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 5, invocationType: InvocationType.EVENT },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(5), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(10), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(20), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(0), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(5), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(10), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.Pipe },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.Pipe },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(0), pollerType: PollerType.EventSource },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource },
    { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource, maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource, maxConcurrency: 5 },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource, maxConcurrency: 5 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource, maxConcurrency: 5 },
  ],
})
export { PollerType }

