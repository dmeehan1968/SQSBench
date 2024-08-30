import { App } from "aws-cdk-lib"
import { SqsBench } from "./SqsBench"

const app = new App()

new SqsBench(app, 'SqsBench', {})
