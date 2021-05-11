import * as core from '@actions/core';
import * as exec from '@actions/exec';
import {promises as fs} from 'fs';
import * as url from 'url';

import setup from './setup-java';

const CUSTOM_CERTIFICATES_PATH = '/usr/local/share/ca-certificates';

export default async function run() {
  try {
    await setup(); 

    const javaHome = process.env.JAVA_HOME;
    if (!javaHome) {
      core.warning('JAVA_HOME not defined');
      return;
    }

    try {
      for (const file of await fs.readdir(CUSTOM_CERTIFICATES_PATH)) {
        console.log(`importing certificate file: ${file}`);
        const returnCode = await exec.exec('keytool', [
          '-import',
          '-noprompt',
          '-trustcacerts',
          '-file',
          `${CUSTOM_CERTIFICATES_PATH}/${file}`,
          '-cacerts',
          '-storepass',
          'changeit',
        ]);

        if (returnCode !== 0) {
          core.error("Could not import CA to Java's trustStore");
        }
      }
    } catch (err) {
      core.error("Error reading custom certificates");
    }

    const proxyUrl = process.env.HTTP_PROXY;
    if (proxyUrl === undefined || proxyUrl === '') {
      core.warning('HTTP_PROXY not defnied');
      return;
    }

    const proxyPort = new url.URL(proxyUrl).port;

    core.exportVariable('GRADLE_OPTS',
      `${process.env.GRADLE_OPTS} ` +
        `-Dhttp.proxyHost=${proxyUrl} -Dhttp.proxyPort=${proxyPort} ` +
        `-Dhttps.proxyHost=${proxyUrl} -Dhttps.proxyPort=${proxyPort} ` +
        `-Djavax.net.ssl.trustStore=${javaHome}/lib/security/cacerts ` +
        '-Djavax.net.ssl.trustStorePassword=changeit'
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
