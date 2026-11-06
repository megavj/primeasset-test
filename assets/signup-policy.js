/* TASK40: 로그인은 계정 확인일 뿐입니다. 필수 정보와 동의가 확인돼야 가입 신청·이용으로 넘어갑니다.
   브라우저 안내·검증 공통 코드이며 DB 권한 검증을 대신하지 않습니다. */
(function () {
  'use strict';
  // assets/branches.js와 같은 기존 본부 목록. DB를 읽지 못했을 때만 사용합니다.
  const FALLBACK = ['188', '227', '236', '242', '246', '249', '254', '255', '285', '308', '320', '338', '345', '346', '350', '364', '375', '379', '384'];
  let branches = FALLBACK.map(no => ({ no })), branchRequest = null;
  const digits = value => String(value || '').replace(/\D/g, '');
  const validName = value => Array.from(String(value || '').trim()).length >= 2;
  const validPhone = value => /^010\d{8}$/.test(digits(value));
  const branchName = value => String(value || '').trim();
  const choices = list => (Array.isArray(list) ? list : branches).map(row => String(typeof row === 'object' ? row.no : row).trim() + '본부');
  const validBranch = (value, list) => choices(list).includes(branchName(value));
  const complete = (profile, list) => {
    if (!profile || profile.status === 'incomplete' || profile.profile_done === false) return false;
    // 이미 승인된 회원의 과거 자유입력·숨김 본부는 보존합니다. 신규 신청과 수정 저장은 목록 선택을 엄격히 검사합니다.
    const affiliation = profile.status === 'active' ? !!branchName(profile.branch) : validBranch(profile.branch, list);
    return validName(profile.name) && validPhone(profile.phone) && affiliation && !!profile.consent_at;
  };
  async function loadBranches(sb) {
    if (!branchRequest) branchRequest = (async () => {
      try {
        const result = await sb.from('branches').select('no,sort').eq('visible', true).order('sort');
        if (!result.error && Array.isArray(result.data) && result.data.length) {
          const rows = result.data.filter(row => row && /^\d+$/.test(String(row.no || '').trim()));
          if (rows.length) branches = rows;
        }
      } catch (_) { /* 공개 페이지와 같은 기존 본부 목록 유지 */ }
      return branches.slice();
    })();
    return branchRequest;
  }
  async function resolveProfile(sb, profile, session) {
    await loadBranches(sb);
    if (!profile || !session || !session.user) return null;
    // 기존 my_profile RPC는 phone·consent_at을 반환하지 않습니다. 자기 행만 RLS로 읽습니다.
    if (!Object.prototype.hasOwnProperty.call(profile, 'phone') || !Object.prototype.hasOwnProperty.call(profile, 'consent_at')) {
      const result = await sb.from('members').select('name,branch,phone,consent_at').eq('id', session.user.id).maybeSingle();
      if (result.error) throw new Error('가입 정보를 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
      if (!result.data) return null;
      return Object.assign({}, profile, result.data);
    }
    return profile;
  }
  function fillBranches(select, selected) {
    const option = (value, label) => { const item = document.createElement('option'); item.value = value; item.textContent = label; return item; };
    select.replaceChildren(option('', '소속 본부를 선택해 주세요'), ...choices().map(value => option(value, value)));
    select.value = validBranch(selected) ? branchName(selected) : '';
  }
  function guide() {
    const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el; };
    const section = node('section', 'pa-signup-guide'); section.setAttribute('aria-label', '가입 → 승인 → 이용 안내');
    section.append(node('p', 'pa-signup-eyebrow', '설계사의 일에 집중하는 공간'), node('h2', '', '질문부터 업무 자료까지, 한곳에서'), node('p', 'pa-signup-intro', 'AI 질문, 업무 도구, 보험자료를 필요한 순간 가까이. 가입 정보를 남기고 나의 업무 공간을 준비하세요.'));
    const steps = node('ol', 'pa-signup-steps');
    [['가입', '나를 알리고 시작하세요', '로그인 후 이름·휴대폰·소속 본부를 입력하고 개인정보 수집·이용에 동의하면 가입 신청이 접수됩니다.'],
      ['승인', '확인 후 함께합니다', '관리자가 가입 정보를 확인합니다. 승인되면 부여된 등급에 맞는 도구를 이용할 수 있습니다.'],
      ['이용', '상담과 업무에 집중하세요', 'AI에 질문하고, 업무 도구와 보험자료를 찾아 일상 업무에 활용하세요.']].forEach(([label, title, text], i) => {
      const item = node('li', ''); item.append(node('span', 'pa-signup-step', String(i + 1).padStart(2, '0') + ' · ' + label), node('h3', '', title), node('p', '', text)); steps.append(item);
    });
    section.append(steps); return section;
  }
  window.PA_SIGNUP = { validName, validPhone, validBranch, complete, loadBranches, resolveProfile, fillBranches, guide };
})();
