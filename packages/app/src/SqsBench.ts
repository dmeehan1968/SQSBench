import { Stack } from "aws-cdk-lib"
import { Construct } from "constructs"
import { SqsBenchDashboard } from "@sqsbench/dashboard"
import { SqsProducer } from "@sqsbench/producer"
import { SqsTest, SqsTestProps } from "@sqsbench/benchmark"

interface Props {
  tests: SqsTestProps[]
}

export class SqsBench extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id)

    // add tests
    const tests = props.tests.map(test => new SqsTest(this, test))

    // add producer
    new SqsProducer(this, 'Producer', {
      queues: tests.map(test => ({ queue: test.queue, enabled: test.enabled })),
      enabled: tests.reduce((acc, test) => acc || test.enabled, false),
      dutyCycle: 0.75,
    })

    // add dashboard
    new SqsBenchDashboard(this, 'Dashboard', {
      tests,
    })
  }
}