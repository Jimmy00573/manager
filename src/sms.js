// ============================================================
//  SMS 발송 모듈
//  API 연동 시 아래 설정값을 채우세요
// ============================================================

const SMS_CONFIG = {
  provider: 'aligo',    // 'aligo' | 'solapi' | 'naver'

  // 알리고 (https://smartsms.aligo.in)
  aligo: {
    apiKey: '',         // API Key
    userId: '',         // 사용자 ID
    sender: ''          // 발신번호
  },

  // 솔라피 (https://solapi.com)
  solapi: {
    apiKey: '',
    apiSecret: '',
    sender: ''
  },

  // 네이버 SENS (https://www.ncloud.com/product/applicationService/sens)
  naver: {
    serviceId: '',
    accessKey: '',
    secretKey: '',
    sender: ''
  }
};

let _smsProvider = 'aligo';

function selPv(p) {
  _smsProvider = p;
  ['aligo', 'solapi', 'naver'].forEach(x => {
    const el = document.getElementById('pv-' + x);
    if (el) el.classList.toggle('sel', x === p);
  });
}

async function sendSms() {
  const to = document.getElementById('sms-to')?.value?.trim();
  const body = document.getElementById('sms-body')?.value?.trim();
  const statusEl = document.getElementById('sms-stat');
  const sendBtn = document.getElementById('sms-send-btn');

  if (!to || !body) {
    alert('수신번호와 문자 내용을 확인해 주세요');
    return;
  }

  statusEl.style.display = '';
  statusEl.className = 'sms-stat pending';
  statusEl.textContent = '⏳ 발송 중...';
  sendBtn.disabled = true;

  try {
    const cfg = SMS_CONFIG[_smsProvider];

    if (_smsProvider === 'aligo') {
      if (!cfg.apiKey || !cfg.userId) throw new Error('알리고 API 키를 설정해 주세요 (src/sms.js)');

      // 알리고 API 호출 (CORS 이슈로 백엔드 프록시 필요 시 수정)
      const formData = new FormData();
      formData.append('key', cfg.apiKey);
      formData.append('userid', cfg.userId);
      formData.append('sender', cfg.sender || document.getElementById('sms-from')?.value);
      formData.append('receiver', to.replace(/-/g, ''));
      formData.append('msg', body);
      formData.append('testmode_yn', 'N');

      const res = await fetch('https://apis.aligo.in/send/', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.result_code === '1') {
        statusEl.className = 'sms-stat ok';
        statusEl.textContent = `✅ 발송 완료! (${to})`;
      } else {
        throw new Error(data.message || '발송 실패');
      }

    } else if (_smsProvider === 'solapi') {
      throw new Error('솔라피 연동 준비 중입니다. src/sms.js를 참고해 주세요.');
    } else if (_smsProvider === 'naver') {
      throw new Error('네이버 SENS 연동 준비 중입니다. src/sms.js를 참고해 주세요.');
    }

  } catch (err) {
    statusEl.className = 'sms-stat err';
    statusEl.textContent = `⚠ ${err.message}`;
  } finally {
    sendBtn.disabled = false;
  }
}
