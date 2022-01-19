import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as url from 'url';

import setup from './setup-java';

const CUSTOM_CERTIFICATES_PATH = '/usr/local/share/ca-certificates';

export default async function run() {
  try {
    await setup(); 

    const javaCaCertsPaths = [
      `${process.env.JAVA_HOME}/jre/lib/security/cacerts`, // before java 9
      `${process.env.JAVA_HOME}/lib/security/cacerts`, // since java 9
    ];

    var caCertPath = null;
    for (const possibleCaCertPath of javaCaCertsPaths) {
      if (fs.existsSync(possibleCaCertPath)) {
        core.debug(`cacerts file found: ${caCertPath}`);
        caCertPath = possibleCaCertPath
      }
    }

    if (!caCertPath) {
      core.warning(`cacerts file not found, searched in ${javaCaCertsPaths}`);
      return;
    }

    for (const file of await fs.promises.readdir(CUSTOM_CERTIFICATES_PATH)) {
      core.debug(`importing certificate file: ${file}`);
      const returnCode = await exec.exec('keytool', [
        '-import',
        '-noprompt',
        '-trustcacerts',
        '-file',
        `${CUSTOM_CERTIFICATES_PATH}/${file}`,
        '-keystore',
        `${caCertPath}`,
        '-storepass',
        'changeit',
      ]);

      if (returnCode !== 0) {
        core.error("Could not import CA to Java's trustStore");
      }
    }

    var proxyUrlEnv = process.env.HTTP_PROXY;
    if (proxyUrlEnv === undefined || proxyUrlEnv  === '') {
      core.warning('HTTP_PROXY not defnied');
      return;
    }

    const proxyUrl = new url.URL(proxyUrlEnv);
    const proxyHost = proxyUrl.hostname;
    const proxyPort = proxyUrl.port;

    core.exportVariable('GRADLE_OPTS',
      `${process.env.GRADLE_OPTS} ` +
        `-Dhttp.proxyHost=${proxyHost} -Dhttp.proxyPort=${proxyPort} ` +
        `-Dhttps.proxyHost=${proxyHost} -Dhttps.proxyPort=${proxyPort} `
    );
  } catch (error) {
    core.setFailed(error);
  }
}

run();
