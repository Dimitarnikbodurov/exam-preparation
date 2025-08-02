#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ExamPreparationStack } from '../lib/exam-preparation-stack';

const app = new cdk.App();
new ExamPreparationStack(app, 'ExamPreparationStack');
