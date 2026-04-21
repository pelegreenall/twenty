import { defineLogicFunction, HTTPMethod } from 'twenty-sdk';
import { CoreApiClient } from 'twenty-client-sdk/core';

export const SERVE_SURVEY_PAGE_FUNCTION_ID = 'd7bcbea5-baad-400d-8000-000000000023';

// Escape a string for safe injection into a JS string literal
const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const handler = async (event: Record<string, any>) => {
  const qsp = event.queryStringParameters || {};
  const token = (qsp.token as string | undefined) ?? (event.token as string | undefined);
  const surveyId = qsp.surveyId as string | undefined;
  const isPreview = qsp.preview === 'true';

  const client = new CoreApiClient();

  if (isPreview && surveyId) {
    let survey: any;
    try {
      const result = await client.query({
        sm133788Survey: {
          __args: { filter: { id: { eq: surveyId } } },
          id: true,
          name: true,
          surveyJsJson: true,
          primaryColor: true,
          headerBackgroundColor: true,
          headerTextColor: true,
          customCss: true,
          backgroundColor: true,
          cardBackgroundColor: true,
          questionTextColor: true,
          redirectUrl: true,
          redirectDelay: true,
        },
      } as never);
      survey = (result as any)?.sm133788Survey;
    } catch (err) {
      return htmlShell('Error', `<h2>Could not load preview.</h2><p>${escHtml(String(err))}</p>`, true);
    }

    if (!survey) return htmlShell('Not Found', '<h2>Survey not found.</h2>', true);
    return renderSurvey(survey, 'PREVIEW_MODE');
  }

  if (!token) {
    return htmlShell('Invalid Link', '<h2>Invalid survey link.</h2><p>No token provided.</p>', true);
  }

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
          primaryColor: true,
          headerBackgroundColor: true,
          headerTextColor: true,
          customCss: true,
          backgroundColor: true,
          cardBackgroundColor: true,
          questionTextColor: true,
          redirectUrl: true,
          redirectDelay: true,
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

  return renderSurvey(dist.survey, token);
};

function renderSurvey(survey: any, token: string) {
  let surveyJson: object = {};
  try {
    surveyJson = JSON.parse(survey?.surveyJsJson || '{}');
  } catch {
    surveyJson = {};
  }

  const surveyName = survey?.name ?? 'Survey';
  const safeJson = JSON.stringify(surveyJson).replace(/<\/script>/gi, '<\\/script>');
  const safeToken = JSON.stringify(token);
  const primaryColor = survey?.primaryColor || '#0070f3';
  const redirectUrl = survey?.redirectUrl || '';
  const redirectDelay = survey?.redirectDelay ?? 5;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(surveyName)}</title>
  <!-- SurveyJS V2 Styles -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/survey-core/defaultV2.min.css">
  <style>
    :root {
      --sjs-primary-backcolor: ${primaryColor};
      --sjs-primary-backcolor-light: ${primaryColor}1a;
      --sjs-primary-backcolor-dark: ${primaryColor};
      --sjs-primary-forecolor: #ffffff;
      --sjs-base-unit: 8px;
      --sjs-corner-radius: 12px;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      background-color:${survey?.backgroundColor || '#f0f4f8'};
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
      min-height:100vh;
      color:#1e293b;
      line-height:1.5;
    }
    .hdr{
      background-color:${survey?.headerBackgroundColor || '#0070f3'};
      color:${survey?.headerTextColor || '#fff'};
      padding:20px 24px;
      font-size:22px;
      font-weight:700;
      letter-spacing:-.02em;
      box-shadow:0 2px 4px rgba(0,0,0,0.05);
      position:relative;
      z-index:100;
      display:flex;
      align-items:center;
    }
    .preview-badge {
      font-size:12px;
      opacity:0.8;
      margin-left:12px;
      background:rgba(0,0,0,0.15);
      padding:4px 10px;
      border-radius:6px;
      font-weight:600;
      text-transform:uppercase;
      letter-spacing:0.5px;
    }
    .wrap{
      max-width:840px;
      margin:32px auto 80px;
      padding:0 20px;
    }
    
    /* Use user-defined colors for the SurveyJS V2 Modern theme elements */
    .sd-root-modern, .sv-root-modern {
      background-color: ${survey?.backgroundColor || '#f0f4f8'} !important;
    }
    .sd-element--with-frame, .sv-element--with-frame {
      background-color: ${survey?.cardBackgroundColor || '#ffffff'} !important;
      border-radius: var(--sjs-corner-radius) !important;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05) !important;
      margin-bottom: 24px !important;
    }
    .sd-container-modern, .sv-container-modern { padding: 0 !important; }
    .sd-header, .sd-header__text, .sd-container-modern__header,
    .sv-header, .sv-header__text, .sv-container-modern__header,
    .sv-header__title, .sv-header__description, .sv-logo,
    .sv-action-bar, .sv-nav-bar, .sv-header-container, .sv-header__logo-container { 
      display: none !important; 
      height: 0 !important; 
      padding: 0 !important; 
      margin: 0 !important; 
      opacity: 0 !important;
      pointer-events: none !important;
      background: transparent !important;
    } /* Hide redundant SurveyJS header elements */
    
    /* Specifically hide the redundant survey title that causes the white bar */
    .sv-title:empty, .sv-description:empty, .sv-container-modern__title:empty { display: none !important; }
    .sv-header .sv-title, .sv-header .sv-description { display: none !important; }

    .sv-root-modern { background-color: transparent !important; }
    .sd-title, .sv-title { 
      font-weight:700!important; 
      color:${survey?.questionTextColor || '#0f172a'}!important; 
      font-size:24px!important; 
      margin-bottom: 24px !important;
    }
    .sd-action-button--complete, .sd-action-button--next, .sd-action-button--prev, .sd-action-button--welcome,
    .sv-action-button--complete, .sv-action-button--next, .sv-action-button--prev, .sv-action-button--welcome { 
      background-color:${primaryColor}!important; 
      border-radius:8px!important; 
      padding:12px 28px!important; 
      font-weight:700!important; 
      color:#fff!important;
      transition: opacity 0.2s;
      border: none !important;
      cursor: pointer;
      font-size: 16px !important;
    }
    .sd-action-button--prev, .sv-action-button--prev {
      background-color: #64748b !important;
      margin-right: 8px !important;
    }
    .sd-action-button--complete:hover, .sd-action-button--next:hover, .sd-action-button--welcome:hover { opacity: 0.9; }
    
    /* Ensure Welcome Page titles are visible */
    .sd-welcome-page, .sv-welcome-page {
      padding: 40px 0 !important;
      text-align: center;
    }
    .sd-welcome-page__title, .sv-welcome-page__title {
      font-size: 32px !important;
      font-weight: 800 !important;
      color: ${survey?.questionTextColor || '#0f172a'} !important;
      margin-bottom: 16px !important;
      display: block !important;
    }
    .sd-welcome-page__description, .sv-welcome-page__description {
      font-size: 18px !important;
      color: #64748b !important;
      line-height: 1.6;
    }

    /* Custom Welcome Overlay */
    #custom-welcome {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: ${survey?.backgroundColor || '#f0f4f8'};
      z-index: 100;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
    }
    .welcome-card {
      background: ${survey?.cardBackgroundColor || '#ffffff'};
      padding: 60px 40px;
      border-radius: 20px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    }
    .welcome-card h1 {
      font-size: 32px;
      font-weight: 800;
      color: ${survey?.questionTextColor || '#0f172a'};
      margin-bottom: 20px;
    }
    .welcome-card p {
      font-size: 18px;
      color: #64748b;
      margin-bottom: 40px;
      line-height: 1.6;
    }
    .start-btn {
      background-color: ${primaryColor};
      color: #fff;
      border: none;
      padding: 16px 40px;
      font-size: 18px;
      font-weight: 700;
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.2s, opacity 0.2s;
    }
    .start-btn:hover {
      opacity: 0.9;
      transform: translateY(-2px);
    }

    /* Force EVERYTHING in the header to be transparent and hidden */
    .sv-header, .sv-header-container, .sv-header__text, .sv-container-modern__header, 
    .sv-header__title, .sv-header__description, .sv-logo, .sv-title-bar,
    .sv-container-modern__title, .sv-container-modern__description {
      background-color: transparent !important;
      box-shadow: none !important;
      display: none !important;
      height: 0 !important;
      padding: 0 !important;
      margin: 0 !important;
      visibility: hidden !important;
    }
    
    .sv-header .sv-title, .sv-header .sv-description { display: none !important; }
    
    .msg{
      padding:60px 40px;
      border-radius:20px;
      text-align:center;
      background:#fff;
      box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);
      border-top: 6px solid ${primaryColor};
    }
    .msg h2{font-size:28px;margin-bottom:16px;color:#0f172a;font-weight:800}
    .msg p{font-size:18px;color:#475569;line-height:1.6}

    ${survey?.customCss || ''}
  </style>
</head>
<body>
<div class="hdr">
  <span>${escHtml(surveyName)}</span>
  ${token === 'PREVIEW_MODE' ? '<span class="preview-badge">Preview Mode</span>' : ''}
</div>
<div class="wrap" id="wrap" style="position: relative; min-height: 500px;">
  <div id="custom-welcome" style="display: none;">
    <div class="welcome-card">
      <h1 id="welcome-title">Welcome</h1>
      <p id="welcome-desc">Please take a moment to fill out this survey.</p>
      <button class="start-btn" onclick="startSurvey()">Start Survey</button>
    </div>
  </div>

  <div id="surveyElement"></div>
</div>

<!-- SurveyJS Library Core & Browser UI -->
<script src="https://cdn.jsdelivr.net/npm/survey-core/survey.core.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/survey-js-ui/survey-js-ui.min.js"></script>

<script>
(function(){
  var token = ${safeToken};
  var json  = ${safeJson};
  var wrap  = document.getElementById('wrap');
  
  function showMsg(title, body, redirectInfo){
    var html = '<div class="msg"><h2>'+title+'</h2><p>'+body+'</p>';
    if (redirectInfo) {
      html += '<p style="margin-top: 24px; font-size: 14px; opacity: 0.7;">' + redirectInfo + '</p>';
    }
    html += '</div>';
    wrap.innerHTML = html;
  }

  try {
    // Crucial: SurveyJS V2 needs specific theme initialization
    if(typeof Survey !== 'undefined') {
      // Ensure the JSON has the flag before construction
      if (json.showWelcomePage === true || json.showWelcomePage === 'true') {
        json.showWelcomePage = true;
      }

      var survey = new Survey.Model(json);
      
      // Force disable titles to prevent the "white bar"
      survey.showTitle = false;
      survey.showPageTitles = false;
      survey.showQuestionNumbers = "off";

      window.startSurvey = function() {
        document.getElementById('custom-welcome').style.display = 'none';
        // Delay render slightly so the browser can update the layout (fixes rating scale issues)
        setTimeout(function(){
          var el = document.getElementById("surveyElement");
          survey.render(el);
          survey.state = 'running';


        }, 50);
      };

      // Force custom welcome if enabled
      if (json.showWelcomePage) {
        var wpTitle = (json.welcomePage && json.welcomePage.title) || json.title || "Welcome";
        var wpDesc = (json.welcomePage && json.welcomePage.description) || "Please click below to start.";
        
        document.getElementById('welcome-title').innerText = wpTitle;
        document.getElementById('welcome-desc').innerText = wpDesc;
        document.getElementById('custom-welcome').style.display = 'flex';
      } else {
        // No welcome page, render immediately
        var el = document.getElementById("surveyElement");
        survey.render(el);
      }



      survey.onComplete.add(function(sender){
        var successTitle = '✓ Thank you!';
        var successBody = 'Your response has been recorded successfully.';
        
        // Use custom completion HTML if provided in the survey JSON
        if (json.completedHtml) {
          successTitle = 'Submitted';
          successBody = json.completedHtml;
        }

        if (token === 'PREVIEW_MODE') {
          var previewBody = 'This was a test submission. All surveys work correctly. This response was not recorded.' + (json.completedHtml ? '<br><br><b>Your custom message:</b><br>' + json.completedHtml : '');
          var redirectUrl = ${JSON.stringify(redirectUrl)};
          var redirectDelay = ${redirectDelay};
          
          if (redirectUrl) {
            showMsg('✓ Preview Complete', previewBody, 'In a live survey, the user would be redirected to <b>' + redirectUrl + '</b> after ' + redirectDelay + ' seconds.');
          } else {
            showMsg('✓ Preview Complete', previewBody);
          }
          return;
        }
        fetch('/s/submit-survey',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({token:token, answers:sender.data})
        }).then(function(r){
          return r.ok
            ? (function() {
                var redirectUrl = ${JSON.stringify(redirectUrl)};
                var redirectDelay = ${redirectDelay};
                
                if (redirectUrl) {
                  var remaining = redirectDelay;
                  var interval = setInterval(function() {
                    remaining--;
                    if (remaining <= 0) {
                      clearInterval(interval);
                      window.location.href = redirectUrl;
                    } else {
                      showMsg(successTitle, successBody, 'Redirecting in ' + remaining + ' seconds...');
                    }
                  }, 1000);
                  showMsg(successTitle, successBody, 'Redirecting in ' + redirectDelay + ' seconds...');
                } else {
                  showMsg(successTitle, successBody);
                }
              })()
            : r.text().then(function(t){ showMsg('Submission failed', t || 'Please try again.'); });
        }).catch(function(){
          showMsg('Connection error','Please check your connection and try again.');
        });
      });

    } else {
      showMsg('Loading error', 'Survey library could not be loaded. Please refresh the page.');
    }
  } catch(e){
    console.error('[Survey] error:', e);
    showMsg('Survey error', e && e.message ? e.message : 'An unexpected error occurred.');
  }
})();
</script>
</body>
</html>`;
}

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
