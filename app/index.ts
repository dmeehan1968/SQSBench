import { Construct } from "constructs"
import { App, Stack, Stage } from "aws-cdk-lib"

export class MyConstruct extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id)
    }
}

const app = new App()

const stage = new Stage(app, 'MyStage')

const stack = new Stack(stage, 'MyStack')

const myConstruct = new MyConstruct(stack, 'MyConstruct')