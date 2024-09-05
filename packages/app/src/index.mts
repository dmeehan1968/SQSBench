import { App, Duration } from "aws-cdk-lib"
import { PollerType } from "@sqsbench/benchmark"
import { SqsBench } from "./SqsBench.mjs"

const app = new App()

new SqsBench(app, 'SqsBench', {
  minRate: 1,
  maxRate: 4096,
  consumerPerMessageDuration: Duration.millis(50),
  dutyCycle: 1,
  rateDurationInMinutes: 120,
  rateScaleFactor: 2,
  tests: [
    { enabled: true, batchSize: 10, batchWindow: Duration.seconds(0), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(5), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(10), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(20), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(0), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(5), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(10), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.Lambda, maxSessionDuration: Duration.seconds(60), maxConcurrency: 2 },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(0), pollerType: PollerType.Pipe },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(20), pollerType: PollerType.Pipe },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.Pipe },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(0), pollerType: PollerType.EventSource },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(0), pollerType: PollerType.EventSource, maxConcurrency: 2 },
    // { enabled: false, batchSize: 10, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource, maxConcurrency: 2 },
    // { enabled: false, batchSize: 100, batchWindow: Duration.seconds(20), pollerType: PollerType.EventSource, maxConcurrency: 2 },
  ],
})
export { PollerType }

