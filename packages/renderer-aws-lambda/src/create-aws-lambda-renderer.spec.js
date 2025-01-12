const dockerLambda = require('docker-lambda');
const path = require('path');
const fs = require('fs');

const DOCKER_TEST_TIMEOUT = 60000;

const PROJECT_ROOT = path.dirname(path.dirname(path.dirname(__dirname)));

const DEBUG = false;

const executeLambda = event =>
  dockerLambda({
    event,
    dockerArgs: ['-m', '1024M'].concat(DEBUG ? ['-e', 'DEBUG=*'] : []),
    dockerImage: 'lambci/lambda:nodejs8.10',
    taskDir: PROJECT_ROOT,
    handler: 'examples/renderer-aws-lambda/index.handler',
    returnSpawnResult: DEBUG,
  });

const fetchStorybookUrl = async baseUrl =>
  executeLambda({
    command: 'getStorybook',
    baseUrl,
  });

const getStorybookFixtureUrl = fixture =>
  `file:./fixtures/storybook-${fixture}`;

const fetchStorybookScreenshot = async (fixture, id) =>
  executeLambda({
    command: 'captureScreenshotForStory',
    baseUrl: getStorybookFixtureUrl(fixture),
    id,
    options: {
      chromeLoadTimeout: 60000,
      chromeSelector: '#root > *',
    },
    configuration: {
      preset: 'iPhone 7',
      chromeRetries: 0,
    },
  });

const fetchStorybookFixture = async fixture =>
  fetchStorybookUrl(getStorybookFixtureUrl(fixture));

const storybook = [
  {
    id: 'welcome--to-storybook',
    kind: 'Welcome',
    story: 'to Storybook',
  },
  {
    id: 'button--text',
    kind: 'Button',
    story: 'Text',
  },
  {
    id: 'button--emoji',
    kind: 'Button',
    story: 'Emoji',
  },
];

describe('createChromeAWSLambdaRenderer', () => {
  describe('.getStorybook', () => {
    it(
      'fetches stories from static bundles',
      async () => {
        expect(await fetchStorybookFixture('static')).toEqual(storybook);
      },
      DOCKER_TEST_TIMEOUT
    );

    it(
      'throws if not configured',
      async () => {
        await expect(fetchStorybookFixture('unconfigured')).rejects.toThrow(
          "Loki addon not registered. Add `import 'loki/configure-react'` to your .storybook/preview.js file."
        );
      },
      DOCKER_TEST_TIMEOUT
    );

    it(
      'throws if not running',
      async () => {
        await expect(
          fetchStorybookUrl('http://localhost:23456')
        ).rejects.toThrow('Failed fetching stories because the server is down');
      },
      DOCKER_TEST_TIMEOUT
    );
  });

  describe('.captureScreenshotForStory', () => {
    it(
      'captures screenshot',
      async () => {
        const screenshot = await fetchStorybookScreenshot(
          'static',
          'welcome--to-storybook'
        );
        const referencePath = path.resolve(
          __dirname,
          '../__snapshots__/welcome-to-storybook.png'
        );
        const reference = fs.readFileSync(referencePath);
        expect(screenshot).toEqual(reference.toString('base64'));
      },
      DOCKER_TEST_TIMEOUT
    );
  });

  describe('.captureScreenshotsForStories', () => {
    it(
      'captures screenshots',
      async () => {
        const [screenshot] = await executeLambda({
          command: 'captureScreenshotsForStories',
          baseUrl: getStorybookFixtureUrl('static'),
          stories: [
            {
              id: 'welcome--to-storybook',
              kind: 'Welcome',
              story: 'to Storybook',
              configuration: {
                preset: 'iPhone 7',
                chromeRetries: 0,
              },
            },
          ],
          options: {
            chromeLoadTimeout: 60000,
            chromeSelector: '#root > *',
          },
        });

        const referencePath = path.resolve(
          __dirname,
          '../__snapshots__/welcome-to-storybook.png'
        );
        const reference = fs.readFileSync(referencePath);
        expect(screenshot).toEqual(reference.toString('base64'));
      },
      DOCKER_TEST_TIMEOUT
    );
  });
});
