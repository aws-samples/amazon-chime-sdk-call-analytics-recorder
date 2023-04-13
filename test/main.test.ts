import { App } from 'aws-cdk-lib';
import { AmazonChimeSDKCallAnalyticsRecording } from '../src/amazon-chime-sdk-call-analytics-recording';

const recordingStackProps = {
  outputBucket: '',
  recordingBucketPrefix: '',
  buildAsterisk: '',
  sipRecCidrs: '',
  logLevel: '',
  removalPolicy: '',
};

test('IncludedBucket', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'IncludedBucket', {
    ...recordingStackProps,
    recordingBucketPrefix: 'test',
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
