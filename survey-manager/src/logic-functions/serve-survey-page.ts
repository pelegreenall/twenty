import { defineLogicFunction, HTTPMethod } from 'twenty-sdk';
import { CoreApiClient } from 'twenty-client-sdk/core';

export const SERVE_SURVEY_PAGE_FUNCTION_ID = 'd7bcbea5-baad-400d-8000-000000000023';

// Escape a string for safe injection into a JS string literal
const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const handler = async (event: Record<string, any>) => {
  // HTTP GET: token is in queryStringParameters
  // Direct execution: token may be at top level
  const token =
    (event.queryStringParameters?.token as string | undefined) ??
    (event.token as string | undefined);

  if (!token) {
    return htmlShell('Invalid Link', '<h2>Invalid survey link.</h2><p>No token provided.</p>', true);
  }

  const client = new CoreApiClient();

  let dist: any;
  try {
    const result = await client.query({
      sm133788Distribution: {
        __args: { filter: { token: { eq: token } } },
        id: true,
        status: true,
        survey: {
          id: true,
          name: true,
          surveyJsJson: true,
        },
      },
    } as never);
    dist = (result as any)?.sm133788Distribution;
  } catch (err) {
    return htmlShell('Error', `<h2>Could not load survey.</h2><p>${escHtml(String(err))}</p>`, true);
  }

  if (!dist) {
    return htmlShell('Invalid Link', '<h2>This survey link is invalid or has expired.</h2>', true);
  }

  if (dist.status === 'COMPLETED') {
    return htmlShell(
      dist.survey?.name ?? 'Survey',
      '<div class="msg ok"><h2>✓ Already submitted</h2><p>You have already completed this survey. Thank you!</p></div>',
      false,
    );
  }

  let surveyJson: object = {};
  try {
    surveyJson = JSON.parse(dist.survey?.surveyJsJson || '{}');
  } catch {
    surveyJson = {};
  }

  const surveyName = dist.survey?.name ?? 'Survey';

  // Safely embed JSON into a <script> block: escape </script> sequences
  const safeJson = JSON.stringify(surveyJson).replace(/<\/script>/gi, '<\\/script>');
  const safeToken = JSON.stringify(token);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(surveyName)}</title>
  <link rel="stylesheet" href="https://unpkg.com/survey-core@2.5.20/defaultV2.min.css">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh}
    .hdr{background:#0070f3;color:#fff;padding:18px 24px;font-size:20px;font-weight:700;letter-spacing:-.01em}
    .wrap{max-width:780px;margin:28px auto 60px;padding:0 16px}
    .sd-root-modern{background:#fff;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
    .msg{padding:36px 32px;border-radius:12px;text-align:center;margin:40px 0}
    .msg.ok{background:#d1fae5;color:#065f46}
    .msg.err{background:#fee2e2;color:#991b1b}
    .msg h2{font-size:22px;margin-bottom:10px}
    .msg p{font-size:15px;opacity:.85}
  </style>
</head>
<body>
<div class="hdr">${escHtml(surveyName)}</div>
<div class="wrap" id="wrap">
  <div id="survey"></div>
</div>
<script src="https://unpkg.com/survey-core@2.5.20/survey.core.min.js"></script>
<script src="https://unpkg.com/survey-js-ui@2.5.20/survey-js-ui.min.js"></script>
<script>
(function(){
  var token = ${safeToken};
  var json  = ${safeJson};
  var wrap  = document.getElementById('wrap');
  var el    = document.getElementById('survey');

  function showMsg(cls, title, body){
    wrap.innerHTML='<div class="msg '+cls+'"><h2>'+title+'</h2><p>'+body+'</p></div>';
  }

  try {
    var survey = new Survey.Model(json);

    survey.onComplete.add(function(sender){
      fetch('/s/submit-survey',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token:token, answers:sender.data})
      }).then(function(r){
        if(r.ok){
          showMsg('ok','✓ Thank you!','Your response has been recorded successfully.');
        } else {
          r.text().then(function(t){
            showMsg('err','Submission failed',t||'Please try again.');
          });
        }
      }).catch(function(e){
        showMsg('err','Connection error','Please check your connection and try again.');
      });
    });

    new SurveyUI.Survey({model:survey, el:el});
  } catch(e){
    showMsg('err','Survey error',e&&e.message?e.message:'Unknown error');
  }
})();
</script>
</body>
</html>`;
};

// Helper for simple HTML shell pages (error states, already-completed, etc.)
function htmlShell(title: string, bodyHtml: string, isError: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)}</title>
  <style>
    body{font-family:-apple-system,sans-serif;background:#f0f4f8;min-height:100vh;display:flex;flex-direction:column}
    .hdr{background:#0070f3;color:#fff;padding:18px 24px;font-size:20px;font-weight:700}
    .content{flex:1;display:flex;align-items:center;justify-content:center;padding:32px}
    .box{background:#fff;border-radius:12px;padding:36px 40px;max-width:480px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.08);${isError ? 'border-left:4px solid #ef4444' : 'border-left:4px solid #22c55e'}}
    h2{font-size:22px;margin-bottom:10px;color:${isError ? '#991b1b' : '#065f46'}}
    p{color:#64748b;font-size:15px}
  </style>
</head>
<body>
<div class="hdr">${escHtml(title)}</div>
<div class="content"><div class="box">${bodyHtml}</div></div>
</body>
</html>`;
}

export default defineLogicFunction({
  universalIdentifier: SERVE_SURVEY_PAGE_FUNCTION_ID,
  name: 'serve-survey-page',
  description: 'Public HTML page that renders a survey form for a given token',
  httpRouteTriggerSettings: {
    path: '/survey-page',
    httpMethod: HTTPMethod.GET,
    isAuthRequired: false,
  },
  handler: handler as any,
});
