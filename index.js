const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios').default;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');

axiosCookieJarSupport(axios);
const cookieJar = new tough.CookieJar();

const wait = function (seconds) {
    return new Promise((resolve, reject) => {
        if (typeof (seconds) !== 'number') {
            throw new Error('seconds not a number');
        }

        setTimeout(() => resolve(), seconds * 1000)
    });
}

async function run() {
    const tag = github.context.ref.replace('refs/tags/', '');
    const jenkinsHost = core.getInput('jenkins_host');
    const jenkinsBasicAuthToken = core.getInput('jenkins_basic_auth_token');
    const jenkinsJob = core.getInput('jenkins_job');
    const sleepDuration = core.getInput('sleep_duration');
    const authHeader = jenkinsBasicAuthToken.startsWith('Basic ') ? jenkinsBasicAuthToken : `Basic ${jenkinsBasicAuthToken}`;
    let crumb;
    let crumbRequestField;

    try {
        core.info(`Waiting ${sleepDuration} seconds ...`);
        await wait(parseInt(sleepDuration));

        core.info(`Getting CSRF Token to interact with Jenkins...`);
        const csrfResult = await axios.get(`${jenkinsHost}/crumbIssuer/api/json`, {
            jar: cookieJar,
            withCredentials: true,
            headers: {
                Authorization: authHeader
            }
        });
        crumb = csrfResult.data.crumb;
        crumbRequestField = csrfResult.data.crumbRequestField;

        core.info(`Triggering the job`);
        await axios.post(`${jenkinsHost}/job/${jenkinsJob}/view/tags/job/${tag}/build?build?delay=0sec`, null, {
            jar: cookieJar,
            withCredentials: true,
            headers: {
                Authorization: authHeader,
                [crumbRequestField]: crumb
            }
        });

        core.info(`Done!`);
    } catch (error) {
        core.setFailed(error.message);
        core.debug(`The following values may help you debugging.`);
        core.debug(`tag: ${tag}`);
        core.debug(`jenkins_host: ${jenkinsHost}`);
        core.debug(`jenkins_basic_auth_token: ${jenkinsBasicAuthToken}`);
        core.debug(`jenkins_job: ${jenkinsJob}`);
        core.debug(`sleep_duration: ${sleepDuration}`);
        core.debug(`crumb: ${crumb}`);
        core.debug(`crumbRequestField: ${crumbRequestField}`);
        core.error(JSON.stringify(error))
    }
}

run();
