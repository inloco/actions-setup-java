import * as core from '@actions/core';
import * as exec from '@actions/exec';
import {promises as fs} from 'fs';

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
      for (const file in await fs.readdir(CUSTOM_CERTIFICATES_PATH)) {
        const returnCode = await exec.exec('keytool', [
          '-import',
          '-noprompt',
          '-trustcacerts',
          '-alias',
          'incogniadependenciescache',
          '-file',
          `${file}`,
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

    const proxyHost = process.env.HTTP_PROXY;
    if (proxyHost === undefined || proxyHost === '') {
      core.warning('HTTP_PROXY not defnied');
      return;
    }

    const proxyHostAndPort = proxyHost.split(":")
    if (proxyHostAndPort.length != 2) {
      core.warning('HTTP_PROXY does not include port');
      return;
    }

    const proxyPort = proxyHostAndPort[1];

    core.exportVariable('GRADLE_OPTS',
      `${process.env.GRADLE_OPTS} ` +
        `-Dhttp.proxyHost=${proxyHost} -Dhttp.proxyPort=${proxyPort} ` +
        `-Dhttps.proxyHost=${proxyHost} -Dhttps.proxyPort=${proxyPort} ` +
        `-Djavax.net.ssl.trustStore=${javaHome}/lib/security/cacerts ` +
        '-Djavax.net.ssl.trustStorePassword=changeit'
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
