import { useEffect } from "react";

export default function PrivacyPolicy() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "개인정보처리방침 | CONTENTS VIEW";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="privacyPage">
      <header className="privacyHeader">
        <p className="privacyEyebrow">CONTENTS VIEW · LEGAL</p>
        <h1>개인정보처리방침</h1>
        <p>CONTENTS VIEW는 회원 기능과 콘텐츠 분석 서비스를 제공하는 데 필요한 범위에서 개인정보를 처리하고, 관련 법령에 따라 이용자의 권리를 보호합니다.</p>
      </header>

      <article className="privacyContent">
          <section id="items">
            <h2>1. 처리하는 개인정보</h2>
            <p>이 방침은 CONTENTS VIEW 웹사이트의 로그인, 콘텐츠 분석, 보관함 및 서비스 운영 과정에 적용됩니다. 기능별로 다음 정보가 처리됩니다.</p>
            <div className="privacyTableWrap">
              <table>
                <thead><tr><th>구분</th><th>처리 항목</th></tr></thead>
                <tbody>
                  <tr><td>Google 로그인</td><td>계정 식별값, 이메일, 표시 이름, 프로필 이미지, 로그인 정보</td></tr>
                  <tr><td>회원 계정</td><td>회원번호, 이름, 이메일, 프로필 이미지, 역할·승인 상태, 이용권 상태</td></tr>
                  <tr><td>보관함</td><td>저장한 YouTube 영상·채널의 식별값과 제목, 썸네일, 채널명, 저장 일시 등 콘텐츠 정보</td></tr>
                  <tr><td>API 연동</td><td>이용자가 등록한 외부 API 키, 키 일부 표시값, 연결 확인 상태·일시</td></tr>
                  <tr><td>서비스 운영</td><td>로그인 쿠키와 브라우저 저장정보. 접속 IP, 브라우저·기기 정보 및 요청 기록은 호스팅·보안 과정에서 처리될 수 있음</td></tr>
                </tbody>
              </table>
            </div>
            <p>검색어, 분석을 요청한 콘텐츠 URL 등 이용자가 입력한 정보는 해당 기능의 처리에 사용됩니다. 주민등록번호, 결제정보, 건강정보를 서비스 이용을 위해 입력받는 기능은 제공하지 않습니다.</p>
          </section>

          <section id="purposes">
            <h2>2. 개인정보의 처리 목적</h2>
            <ul>
              <li>Google 로그인, 회원 식별 및 계정·권한 관리</li>
              <li>회원별 콘텐츠 접근과 YouTube 영상·채널 보관함 제공</li>
              <li>이용자가 등록한 API 키를 이용한 외부 서비스 연동과 연결 상태 확인</li>
              <li>공지 확인 상태와 화면 설정 유지 등 이용 편의 제공</li>
              <li>오류 대응, 부정 이용 방지 및 서비스 보안 유지</li>
            </ul>
          </section>

          <section id="retention">
            <h2>3. 개인정보의 보유 및 이용 기간</h2>
            <div className="privacyTableWrap">
              <table>
                <thead><tr><th>정보</th><th>보유 기준</th></tr></thead>
                <tbody>
                  <tr><td>회원 계정·프로필</td><td>회원 계정 삭제 요청이 처리될 때까지</td></tr>
                  <tr><td>보관한 영상·채널</td><td>이용자가 해당 보관 항목을 삭제하거나 계정 삭제 요청이 처리될 때까지</td></tr>
                  <tr><td>사용자가 등록한 API 키</td><td>이용자가 해당 키를 삭제하거나 계정 삭제 요청이 처리될 때까지</td></tr>
                  <tr><td>브라우저 저장정보</td><td>이용자가 삭제하거나 해당 정보의 유효기간이 끝날 때까지</td></tr>
                  <tr><td>접속·보안 기록</td><td>보안 및 장애 대응에 필요한 기간 동안 호스팅 사업자의 정책에 따라 처리</td></tr>
                </tbody>
              </table>
            </div>
            <p>관계 법령에 따라 별도로 보존해야 하는 정보가 있는 경우에는 해당 법령에서 정한 기간 동안 보관합니다. 계정 삭제를 요청하면 본인 확인과 법정 보존 대상 확인 후 계정 및 연결된 저장정보를 삭제합니다.</p>
          </section>

          <section id="sharing">
            <h2>4. 제3자 제공</h2>
            <p>CONTENTS VIEW는 이용자의 개인정보를 판매하지 않습니다. 법령에 근거가 있거나 이용자의 동의를 받은 경우 등을 제외하고, 개인정보를 본래의 처리 목적 밖에서 제3자에게 제공하지 않습니다.</p>
            <p>Google 로그인 및 이용자가 선택한 외부 API 기능에는 각 서비스와의 정보 교환이 수반될 수 있습니다. 아래의 외부 서비스 이용 내용도 함께 확인해 주세요.</p>
          </section>

          <section id="providers">
            <h2>5. 외부 서비스 이용 및 국외 처리</h2>
            <p>CONTENTS VIEW는 회원 인증, 데이터 저장 및 웹사이트 운영을 위해 다음 외부 서비스를 이용합니다.</p>
            <div className="privacyTableWrap">
              <table>
                <thead><tr><th>사업자</th><th>이용 기능</th><th>관련 정보</th></tr></thead>
                <tbody>
                  <tr><td>Google</td><td>Google 계정 로그인 및 이용자가 선택한 Google·YouTube API 연동</td><td>로그인 계정 정보, API 요청에 필요한 키·입력값</td></tr>
                  <tr><td>Supabase</td><td>회원 인증, 데이터베이스 및 이슈 이미지 저장</td><td>계정·프로필, 보관함, 사용자 API 키 등 서비스 저장정보</td></tr>
                  <tr><td>Vercel</td><td>웹사이트 호스팅 및 서버 함수 실행</td><td>접속 정보, 인증 정보, API 요청에 포함되는 입력값</td></tr>
                </tbody>
              </table>
            </div>
            <p>Google 로그인은 이용자가 Google 계정으로 로그인할 때 인증 절차를 통해 진행됩니다. 외부 사업자의 인프라에서 서비스 요청 정보가 국외 처리될 수 있으며, 처리 내용이 변경되면 이 방침에 반영합니다.</p>
            <p>국외 처리를 원하지 않는 이용자는 아래 문의처로 계정 삭제를 요청할 수 있습니다. 이 경우 로그인 및 회원 기능을 사용할 수 없습니다.</p>
          </section>

          <section id="storage">
            <h2>6. 쿠키와 브라우저 저장정보</h2>
            <p>로그인 상태 확인을 위한 인증 쿠키와 브라우저의 로컬·세션 저장소를 사용합니다. 브라우저에는 로그인 세션, 화면 테마, 공지 확인 상태, 비회원 급상승 영상 열람 횟수, 비회원 안내창 표시 여부 등이 저장될 수 있습니다. 일부 뉴스 목록도 세션 중 임시 저장됩니다.</p>
            <p>YouTube 보관함의 영상·채널 항목은 로그인한 계정의 서버 데이터베이스에 저장됩니다. 브라우저 데이터를 지우는 것만으로 서버 보관함이 삭제되지는 않습니다. 이용자는 브라우저 설정에서 쿠키와 저장정보를 삭제하거나 차단할 수 있으나, 로그인 및 일부 편의 기능이 제한될 수 있습니다.</p>
          </section>

          <section id="rights">
            <h2>7. 이용자의 권리와 행사 방법</h2>
            <p>이용자는 관련 법령에 따라 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지 등을 요청할 수 있습니다. 요청은 본인 확인 후 관계 법령에서 정한 절차에 따라 처리합니다.</p>
            <ul>
              <li>프로필 이름은 마이페이지에서 직접 수정할 수 있습니다.</li>
              <li>보관한 영상·채널과 등록한 API 키는 해당 서비스 화면에서 개별 삭제할 수 있습니다.</li>
              <li>Google 계정과의 로그인 연결은 Google 계정 설정에서도 관리할 수 있습니다.</li>
              <li>계정 또는 서버에 저장된 정보의 삭제는 아래 개인정보 문의처로 요청할 수 있습니다.</li>
            </ul>
          </section>

          <section id="deletion">
            <h2>8. 개인정보의 파기</h2>
            <p>보유기간이 끝나거나 처리 목적이 달성된 개인정보는 관계 법령상 보존 의무가 없는 한 삭제합니다. 서버에 저장된 전자적 정보는 해당 저장소의 삭제 절차에 따라 처리하고, 브라우저에 저장된 정보는 이용자가 브라우저 설정을 통해 삭제할 수 있습니다.</p>
          </section>

          <section id="security">
            <h2>9. 안전성 확보 조치</h2>
            <p>회원 인증, 관리자 권한 구분, 데이터베이스 접근 정책 및 서버 환경변수 관리 등 서비스에 적용된 보호 조치를 운영합니다. 이용자가 등록한 API 키는 서버 기능의 접근 권한을 제한하고 요청한 연동 기능을 수행하는 데 사용합니다.</p>
          </section>

          <section id="contact">
            <h2>10. 개인정보 보호 문의</h2>
            <p>개인정보 열람·정정·삭제 요청과 관련 문의는 아래로 보내 주세요. 계정 정보 관련 요청은 본인 확인 후 처리합니다.</p>
            <ul>
              <li>담당: CONTENTS VIEW 개인정보 보호 담당자</li>
              <li>이메일: edenofcl@gmail.com</li>
            </ul>
          </section>

          <section id="changes">
            <h2>11. 방침의 변경</h2>
            <p>방침이 변경되는 경우 시행 전에 웹사이트 공지 또는 이 페이지를 통해 변경 내용을 안내합니다. 이용자의 권리에 중대한 영향을 주는 변경은 충분한 기간을 두고 알립니다.</p>
          </section>
          <p className="privacyEffectiveDate">시행일: 2026.10.12</p>
      </article>
    </div>
  );
}
