// upload.js
(function(){
  const ALLOWED = new Set([
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png'
  ]);

  function isAllowed(file){
    if(!file) return false;
    if(ALLOWED.has(file.type)) return true;
    const name = (file.name || '').toLowerCase();
    return name.endsWith('.pdf') || name.endsWith('.txt') || name.endsWith('.docx') || name.endsWith('.pptx') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
  }

  function initUpload(ctx){
    const { elements, toast, appendMessage, state } = ctx;
    const { uploadBtn, fileInput } = elements;

    async function handleExamModePdfUpload(file){
      try {
        const enabled = !!(window.ExamModeContext && window.ExamModeContext.getEnabled && window.ExamModeContext.getEnabled());
        if(!enabled) return false;

        const sessionId = window.__EXAM_MODE_SESSION_ID__ ? String(window.__EXAM_MODE_SESSION_ID__) : '';
        if(!sessionId) return false;

        const base64 = await new Promise((resolve, reject)=>{
          const r = new FileReader();
          r.onerror = () => reject(new Error('READ_FAILED'));
          r.onload = () => {
            const out = String(r.result || '');
            const comma = out.indexOf(',');
            resolve(comma >= 0 ? out.slice(comma + 1) : out);
          };
          r.readAsDataURL(file);
        });

        const subject = (window.ExamModeUI && window.ExamModeUI.getAnswers) ? (window.ExamModeUI.getAnswers().subject || state.subject) : (state.subject || 'General');
        const term = (window.ExamModeUI && window.ExamModeUI.getAnswers) ? (window.ExamModeUI.getAnswers().term || 'Third') : 'Third';

        const upRes = await window.Api.apiFetch('/exam-mode/upload-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, pdf_base64: base64, subject, term })
        });
        if(!upRes.ok) throw new Error('HTTP_' + upRes.status);

        // Ask first question
        const askRes = await window.Api.apiFetch('/exam-mode/ask-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, subject, term })
        });
        if(!askRes.ok) throw new Error('HTTP_' + askRes.status);
        const askData = await askRes.json();

        const text = (askData && askData.question && askData.question.text) ? String(askData.question.text) : 'I could not extract a question from that PDF.';
        if(window.ExamModeUI && window.ExamModeUI.appendAiMessage){
          window.ExamModeUI.appendAiMessage('✅ PDF loaded. Here is your first question:\n\n' + text);
        } else {
          appendMessage('ai', '✅ PDF loaded. Here is your first question:\n\n' + text);
        }

        return true;
      } catch (e) {
        return false;
      }
    }

    function isImage(file){
      const t = String(file && file.type || '').toLowerCase();
      if(t.startsWith('image/')) return true;
      const name = String(file && file.name || '').toLowerCase();
      return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
    }

    function showUnsupported(){
      appendMessage('ai','⚠️ Unsupported file type. Please upload PDF, TXT, DOCX, PPTX, or image files.');
    }

    async function uploadFiles(files){
      const list = Array.from(files || []);
      if(list.length === 0) return;

      for(const f of list){
        if(!isAllowed(f)){
          showUnsupported();
          continue;
        }

        appendMessage('ai', (isImage(f) ? '🖼️ Uploaded: ' : '📄 Uploaded: ') + f.name);

        // Exam Mode: PDF upload becomes the paper source for real question extraction
        if(!isImage(f) && String(f.name || '').toLowerCase().endsWith('.pdf')){
          const handled = await handleExamModePdfUpload(f);
          if(handled) continue;
        }

        // Images: run OCR then feed extracted text into chat
        if(isImage(f)){
          const fdImg = new FormData();
          fdImg.append('image', f, f.name);
          try {
            const res = await window.Api.apiFetch('/multimodal/upload_image', { method:'POST', body: fdImg });
            if(!res.ok) throw new Error('HTTP_' + res.status);
            const data = await res.json();
            const extracted = (data && data.text) ? String(data.text) : '';

            if(!extracted.trim()){
              appendMessage('ai', 'I could not read any text from that image. Try a clearer photo.');
              continue;
            }

            appendMessage('ai', '📄 Extracted text:\n' + extracted);

            // Put into input and auto-send
            try {
              const inputBox = document.getElementById('inputBox');
              const sendBtn = document.getElementById('sendBtn');
              if(inputBox){
                inputBox.value = 'Please solve/explain this:\n' + extracted;
                try { inputBox.dispatchEvent(new Event('input')); } catch (e) {}
              }
              if(sendBtn) sendBtn.click();
            } catch (e) {}
          } catch (e){
            toast('⚠️ OCR server not responding. Please try again later.', {duration: 5000});
          }
          continue;
        }

        const fd = new FormData();
        fd.append('file', f);
        fd.append('subject', state.subject || 'General');
        fd.append('language', state.language || 'English');

        try {
          const res = await window.Api.apiFetch('/upload', { method:'POST', body: fd });
          if(!res.ok){
            throw new Error('HTTP_' + res.status);
          }
          // no UI change required on success
        } catch (e){
          toast('⚠️ Server not responding. Please try again later.', {duration: 5000});
        }
      }
    }

    if(uploadBtn && fileInput){
      uploadBtn.addEventListener('click', ()=> fileInput.click());
      fileInput.addEventListener('change', ()=>{
        uploadFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    return { uploadFiles };
  }

  window.Upload = { initUpload };
})();
