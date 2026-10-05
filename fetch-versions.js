import https from 'https';

function fetchVersion(pkg) {
  return new Promise((resolve) => {
    https.get(`https://registry.npmjs.org/${pkg}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        console.log(`${pkg}: latest -> ${json['dist-tags'].latest}`);
        resolve();
      });
    });
  });
}

async function run() {
  await fetchVersion('@tanstack/react-start');
  await fetchVersion('@tanstack/react-router');
  await fetchVersion('@tanstack/router-plugin');
  await fetchVersion('@tanstack/start-server-core');
}

run();
