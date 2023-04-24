import { App } from 'aws-cdk-lib';
import {
  AmazonChimeSDKCallAnalyticsRecording,
  AmazonChimeSDKCallAnalyticsSummarization,
} from '../src/amazon-chime-sdk-call-analytics-recording';
import { InstanceTypes, ModelArns } from '../src/cohereInput';

const recordingStackProps = {
  outputBucket: '',
  recordingBucketPrefix: '',
  buildAsterisk: '',
  sipRecCidrs: '',
  logLevel: '',
  removalPolicy: '',
  selectiveRecording: '',
};

test('Empty', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'IncludedBucket', {
    ...recordingStackProps,
  });
});

test('IncludedBucketPrefix', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'IncludedBucket', {
    ...recordingStackProps,
    recordingBucketPrefix: 'test',
  });
});

test('IncludedBucket', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'IncludedBucket', {
    ...recordingStackProps,
    outputBucket: 'test',
  });
});

test('GoodCIDR', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'GoodCIDR', {
    ...recordingStackProps,
    sipRecCidrs: '198.51.100.0/27',
  });
});

test('AsteriskAndLogLevels', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'AsteriskAndLogLevels', {
    ...recordingStackProps,
    buildAsterisk: 'true',
    logLevel: 'DEBUG',
  });
});

test('RETAIN', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'RETAIN', {
    ...recordingStackProps,
    removalPolicy: 'RETAIN',
  });
});

test('DESTROY', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'DESTROY', {
    ...recordingStackProps,
    removalPolicy: 'DESTROY',
  });
});

test('SNAPSHOT', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'SNAPSHOT', {
    ...recordingStackProps,
    removalPolicy: 'SNAPSHOT',
  });
});

test('GoodCIDRs', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'GoodCIDRs', {
    ...recordingStackProps,
    sipRecCidrs: '198.51.100.0/27,198.51.100.128/28',
  });
});

test('BadBucketName', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'BadBucketName', {
      ...recordingStackProps,
      outputBucket: '-bad',
    });
  }).toThrow('OUTPUT_BUCKET must be a valid S3 bucket name');
});

test('TooManyCIDRs', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'TooManyCIDRs', {
      ...recordingStackProps,
      sipRecCidrs:
        '198.51.100.0/27,198.51.100.128/28,198.51.100.0/27,198.51.100.128/28,198.51.100.0/27,198.51.100.128/28,198.51.100.0/27,198.51.100.128/28,198.51.100.0/27,198.51.100.128/28,198.51.100.0/27,198.51.100.128/28',
    });
  }).toThrow('SIPREC_CIDRS must not contain more than 10 CIDRs');
});

test('PrivateCIDR', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'PrivateCIDR', {
      ...recordingStackProps,
      sipRecCidrs: '10.10.10.10/32',
    });
  }).toThrow(
    'CIDR block 10.10.10.10/32 contains an RFC 1918 private IP address',
  );
});

test('BADCIDR', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'BadCIDR', {
      ...recordingStackProps,
      sipRecCidrs: 'bad',
    });
  }).toThrow('Invalid CIDR block: bad');
});

test('BadLogLevel', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'BadLogLevel', {
      ...recordingStackProps,
      logLevel: 'bad',
    });
  }).toThrow('LOG_LEVEL must be ERROR, WARN, DEBUG, or INFO');
});

test('BadRemovalPolicy', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'BadRemovalPolicy', {
      ...recordingStackProps,
      removalPolicy: 'bad',
    });
  }).toThrow('REMOVAL_POLICY must be DESTROY, SNAPSHOT, or RETAIN');
});

test('BadSelectiveRecording', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'BadRemovalPolicy', {
      ...recordingStackProps,
      selectiveRecording: 'bad',
    });
  }).toThrow('SELECTIVE_RECORDING must be true or false');
});

test('BadBuildAsterisk', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'BadBuildAsterisk', {
      ...recordingStackProps,
      buildAsterisk: 'bad',
    });
  }).toThrow('BUILD_ASTERISK must be true or false');
});

test('AsteriskAndSIPREC', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'AsteriskAndSIPREC', {
      ...recordingStackProps,
      buildAsterisk: 'true',
      sipRecCidrs: '198.51.100.0/27',
    });
  }).toThrow('BUILD_ASTERISK and SIPREC_CIDRS cannot both be true');
});

test('SummarizationSelectiveRecording', () => {
  const app = new App();
  const recordingTest = new AmazonChimeSDKCallAnalyticsRecording(
    app,
    'RecordingSelectiveRecording',
    {
      ...recordingStackProps,
      selectiveRecording: 'true',
    },
  );

  const summarizationStackProps = {
    recordingBucket: recordingTest.recordingBucket,
    voiceConnector: recordingTest.voiceConnector,
    recordingBucketPrefix: '',
    selectiveRecording: '',
    modelName: '',
    logLevel: '',
    endpointName: '',
    cohereInstanceType: 'ml.g5.xlarge',
    modelPackageArn:
      'arn:aws:sagemaker:us-east-1:865070037744:model-package/cohere-gpt-medium-v1-5-15e34931a06235b7bac32dca396a970a',
  };

  new AmazonChimeSDKCallAnalyticsSummarization(
    app,
    'SummarizationSelectiveRecording',
    {
      ...summarizationStackProps,
      selectiveRecording: 'true',
    },
  );
});

test('InvalidModelArn', () => {
  expect(() => {
    const app = new App();
    const recordingTest = new AmazonChimeSDKCallAnalyticsRecording(
      app,
      'RecordingInvalidModelArn',
      {
        ...recordingStackProps,
        selectiveRecording: 'true',
      },
    );

    const summarizationStackProps = {
      recordingBucket: recordingTest.recordingBucket,
      voiceConnector: recordingTest.voiceConnector,
      recordingBucketPrefix: '',
      selectiveRecording: '',
      modelName: '',
      logLevel: '',
      endpointName: '',
      cohereInstanceType: 'ml.g5.xlarge',
      modelPackageArn: 'badArn',
    };

    new AmazonChimeSDKCallAnalyticsSummarization(
      app,
      'SummarizationInvalidModelArn',
      {
        ...summarizationStackProps,
        selectiveRecording: 'true',
      },
    );
  }).toThrow(
    'Invalid Model Arn.  Valid Model Arns are: ' + Object.values(ModelArns),
  );
});

test('InvalidInstanceType', () => {
  expect(() => {
    const app = new App();
    const recordingTest = new AmazonChimeSDKCallAnalyticsRecording(
      app,
      'RecordingInvalidInstanceType',
      {
        ...recordingStackProps,
        selectiveRecording: 'true',
      },
    );

    const summarizationStackProps = {
      recordingBucket: recordingTest.recordingBucket,
      voiceConnector: recordingTest.voiceConnector,
      recordingBucketPrefix: '',
      selectiveRecording: '',
      modelName: '',
      logLevel: '',
      endpointName: '',
      cohereInstanceType: 'badInstanceType',
      modelPackageArn:
        'arn:aws:sagemaker:us-east-1:865070037744:model-package/cohere-gpt-medium-v1-5-15e34931a06235b7bac32dca396a970a',
    };

    new AmazonChimeSDKCallAnalyticsSummarization(
      app,
      'SummarizationInvalidInstanceType',
      {
        ...summarizationStackProps,
        selectiveRecording: 'true',
      },
    );
  }).toThrow(
    'Invalid Instance Type.  Valid types are: ' + Object.values(InstanceTypes),
  );
});

test('InvalidSelectiveRecording', () => {
  expect(() => {
    const app = new App();
    const recordingTest = new AmazonChimeSDKCallAnalyticsRecording(
      app,
      'RecordingInvalidSelectiveRecording',
      {
        ...recordingStackProps,
        selectiveRecording: 'true',
      },
    );

    const summarizationStackProps = {
      recordingBucket: recordingTest.recordingBucket,
      voiceConnector: recordingTest.voiceConnector,
      recordingBucketPrefix: '',
      selectiveRecording: '',
      modelName: '',
      logLevel: '',
      endpointName: '',
      cohereInstanceType: 'ml.g5.xlarge',
      modelPackageArn:
        'arn:aws:sagemaker:us-east-1:865070037744:model-package/cohere-gpt-medium-v1-5-15e34931a06235b7bac32dca396a970a',
    };

    new AmazonChimeSDKCallAnalyticsSummarization(
      app,
      'SummarizationInvalidSelectiveRecording',
      {
        ...summarizationStackProps,
        selectiveRecording: 'bad',
      },
    );
  }).toThrow('SELECTIVE_RECORDING must be true or false');
});

test('SummarizationEmpty', () => {
  const app = new App();
  const recordingTest = new AmazonChimeSDKCallAnalyticsRecording(
    app,
    'RecordingSummarizationEmpty',
    {
      ...recordingStackProps,
    },
  );

  const summarizationStackProps = {
    recordingBucket: recordingTest.recordingBucket,
    voiceConnector: recordingTest.voiceConnector,
    recordingBucketPrefix: '',
    selectiveRecording: '',
    modelName: '',
    logLevel: '',
    endpointName: '',
    cohereInstanceType: 'ml.g5.xlarge',
    modelPackageArn:
      'arn:aws:sagemaker:us-east-1:865070037744:model-package/cohere-gpt-medium-v1-5-15e34931a06235b7bac32dca396a970a',
  };

  new AmazonChimeSDKCallAnalyticsSummarization(
    app,
    'SummarizationSummarizationEmpty',
    {
      ...summarizationStackProps,
    },
  );
});
