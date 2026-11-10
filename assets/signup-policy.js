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
    // UNSLOP 2026-11-10 ④ 문구: 광고 문구 대신 이 사이트에 이미 적힌 사실만(소개 = 페이지 설명문, 단계 = 실제 절차)
    section.append(node('h2', '', '가입부터 이용까지 3단계'), node('p', 'pa-signup-intro', '프라임에셋 프리미엄 설계사 전용입니다. 로그인하고 승인받으면 업무 도구를 한곳에서 이용할 수 있습니다.'));
    const steps = node('ol', 'pa-signup-steps'); steps.setAttribute('role', 'list');
    // 장식은 낭독에서 제외하고, 단계 순서는 ol의 목록 구조로 전달합니다.
    const iconPaths = [
      ['M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2', 'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0', 'M19 8v6m-3-3h6'],
      ['M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6Z', 'm8 12 3 3 5-6'],
      ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'M3 9h18M8 9v11', 'M12 13h5m-5 3h3']
    ];
    [['가입 정보 입력', '로그인 후 이름·휴대폰·소속 본부를 입력하고 개인정보 수집·이용에 동의하면 가입 신청이 접수됩니다.'],
      ['관리자 승인', '관리자가 가입 정보를 확인합니다. 승인되면 부여된 등급에 맞는 도구를 이용할 수 있습니다.'],
      ['업무 도구 이용', 'AI 질문과 업무 도구는 등급에 따라 열리고, 보험자료는 승인 후 볼 수 있습니다.']].forEach(([title, text], i) => {
      const item = node('li', '');
      if (i < iconPaths.length - 1) {
        const connector = node('span', 'pa-signup-connector'); connector.setAttribute('aria-hidden', 'true'); item.append(connector);
      }
      const number = node('span', 'pa-signup-number', String(i + 1)); number.setAttribute('aria-hidden', 'true');
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'pa-signup-icon'); icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('width', '18'); icon.setAttribute('height', '18');
      icon.setAttribute('fill', 'none'); icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '1.5'); icon.setAttribute('stroke-linecap', 'round'); icon.setAttribute('stroke-linejoin', 'round');
      icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('focusable', 'false');
      iconPaths[i].forEach(d => { const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d); icon.append(path); });
      const heading = node('h3', 'pa-signup-step'); heading.append(icon, node('span', '', title)); // 단계 이름 하나(아이콘 + 이름)
      const content = node('div', 'pa-signup-content'); content.append(heading, node('p', '', text));
      item.append(number, content); steps.append(item);
    });
    section.append(steps); return section;
  }
  window.PA_SIGNUP = { validName, validPhone, validBranch, complete, loadBranches, resolveProfile, fillBranches, guide };
})();
