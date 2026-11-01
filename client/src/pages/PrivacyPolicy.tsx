import { useEffect } from "react";
import { PARTNERSHIP_RETENTION_NOTICE, PARTNERSHIP_TRANSFER_NOTICE } from "@shared/partnershipConsent";

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
        <p className="privacyEyebrow">CONTENTS VIEW</p>
        <h1>개인정보처리방침</h1>
        <p>에덴 컴퍼니(이하 “운영자”)는 CONTENTS VIEW(컨텐츠뷰)의 회원 기능과 콘텐츠 분석 서비스를 제공하는 데 필요한 범위에서 개인정보를 처리하고, 관련 법령에 따라 이용자의 권리를 보호합니다.</p>
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
                  <tr><td>보관함</td><td>회원 식별값, 저장한 YouTube·TikTok 영상 및 Instagram 게시물·릴스의 URL·식별값, 제목, 썸네일, 채널·작성자 이름과 주소, 저장 일시 등 해당 콘텐츠에서 확인 가능한 정보</td></tr>
                  <tr><td>API 연동</td><td>이용자가 등록한 외부 API 키, 키 일부 표시값, 연결 확인 상태·일시</td></tr>
                  <tr><td>제휴 문의</td><td>이름 또는 상호명, 연락처, 이메일, 문의 내용, 접수 일시, 수집·이용 및 국외 이전 동의 문구·버전·동의 일시</td></tr>
                  <tr><td>서비스 운영</td><td>로그인 쿠키와 브라우저 저장정보. 접속 IP, 브라우저·기기 정보 및 요청 기록은 호스팅·보안 과정에서 처리될 수 있음</td></tr>
                  <tr><td>분석 이용 제한</td><td>일별 분석 횟수, 계정 또는 접속 IP를 기반으로 생성한 일별 해시 식별값</td></tr>
                </tbody>
              </table>
            </div>
            <p>검색어, 분석을 요청한 콘텐츠 URL 등 이용자가 입력한 정보는 해당 기능의 처리에 사용됩니다. 주민등록번호, 결제정보, 건강정보를 서비스 이용을 위해 입력받는 기능은 제공하지 않습니다.</p>
            <p>개인정보는 Google 로그인 과정, 이용자가 보관함·API 연동·제휴 문의 화면에 직접 입력하는 과정 및 서비스 이용에 필요한 쿠키·접속 기록 생성 과정에서 처리됩니다. 공개 콘텐츠의 정보는 해당 플랫폼의 API 또는 공개 페이지에서 확인합니다. 외부 플랫폼의 계정 비밀번호를 입력받지 않습니다.</p>
          </section>

          <section id="purposes">
            <h2>2. 개인정보의 처리 목적</h2>
            <ul>
              <li>Google 로그인, 회원 식별 및 계정·권한 관리</li>
              <li>회원별 콘텐츠 접근과 YouTube·TikTok·Instagram 콘텐츠 보관함 제공</li>
              <li>이용자가 요청한 검색어·콘텐츠 분석 및 저장한 영상의 정보 확인</li>
              <li>이용자가 등록한 API 키를 이용한 외부 서비스 연동과 연결 상태 확인</li>
              <li>공지 확인 상태와 화면 설정 유지 등 이용 편의 제공</li>
              <li>제휴 문의 접수, 내용 확인 및 답변</li>
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
                  <tr><td>보관함 정보</td><td>이용자가 해당 보관 항목을 삭제하거나 계정 삭제 요청이 처리될 때까지</td></tr>
                  <tr><td>사용자가 등록한 API 키</td><td>이용자가 해당 키를 삭제하거나 계정 삭제 요청이 처리될 때까지</td></tr>
                  <tr><td>제휴 문의 및 동의 기록</td><td>{PARTNERSHIP_RETENTION_NOTICE}. 본인 확인 후 삭제 요청을 처리한 경우 그 이전에 삭제</td></tr>
                  <tr><td>브라우저 저장정보</td><td>이용자가 삭제하거나 해당 정보의 유효기간이 끝날 때까지</td></tr>
                  <tr><td>접속·보안 기록</td><td>보안 및 장애 대응에 필요한 기간 동안 호스팅 사업자의 정책에 따라 처리</td></tr>
                  <tr><td>분석 횟수 기록</td><td>일일 이용 제한에 사용하며, 7일이 지난 기록은 후속 분석 요청 시 삭제</td></tr>
                </tbody>
              </table>
            </div>
            <p>관계 법령에 따라 별도로 보존해야 하는 정보가 있는 경우에는 해당 법령에서 정한 기간 동안 보관합니다. 계정 삭제를 요청하면 본인 확인과 법정 보존 대상 확인 후 계정 및 연결된 저장정보를 삭제합니다.</p>
            <p>분석 횟수 기록의 7일 기준은 후속 요청 시 정리하는 기준으로, 생성 후 정확히 7일이 되는 시점에 자동 삭제된다는 의미는 아닙니다. 보관함 삭제는 외부 플랫폼의 원본 콘텐츠 삭제를 의미하지 않습니다.</p>
            <p>제휴 문의는 접수 화면의 수집·이용 및 국외 이전 동의를 각각 확인한 후 제출할 수 있습니다. 동의를 거부해도 사이트의 다른 기능을 이용하는 데에는 영향이 없습니다. 문의 및 동의 기록은 접수일로부터 1년이 지난 뒤 매일 한국 시간 03시 15분에 수행되는 삭제 작업에서 함께 삭제합니다.</p>
          </section>

          <section id="sharing">
            <h2>4. 제3자 제공</h2>
            <p>CONTENTS VIEW는 이용자의 개인정보를 판매하지 않습니다. 법령에 근거가 있거나 이용자의 동의를 받은 경우 등을 제외하고, 개인정보를 본래의 처리 목적 밖에서 제3자에게 제공하지 않습니다.</p>
            <p>Google 로그인 및 이용자가 선택한 외부 API 기능에는 각 서비스와의 정보 교환이 수반될 수 있습니다. 아래의 외부 서비스 이용 내용도 함께 확인해 주세요.</p>
          </section>

          <section id="providers">
            <h2>5. 처리업무 위탁 및 외부 서비스 이용</h2>
            <p>CONTENTS VIEW는 회원 인증, 데이터 저장 및 웹사이트 운영을 위해 다음 외부 서비스를 이용합니다.</p>
            <div className="privacyTableWrap">
              <table>
                <thead><tr><th>사업자</th><th>이용 기능</th><th>관련 정보</th></tr></thead>
                <tbody>
                  <tr><td>Google</td><td>Google 계정 로그인 및 이용자가 선택한 Google·YouTube API 연동</td><td>로그인 계정 정보, API 요청에 필요한 키·입력값</td></tr>
                  <tr><td>Supabase Pte. Ltd.</td><td>회원 인증, 데이터베이스 및 이슈 이미지 저장</td><td>계정·프로필, 보관함, 사용자 API 키, 제휴 문의 등 서비스 저장정보</td></tr>
                  <tr><td>Vercel Inc.</td><td>웹사이트 호스팅 및 서버 함수 실행</td><td>접속 정보, 인증 정보, API 요청에 포함되는 입력값</td></tr>
                </tbody>
              </table>
            </div>
            <p>Supabase와 Vercel은 인증·저장·호스팅 등 서비스 운영 업무에 이용됩니다. 외부 로그인, API 요청, 영상 재생 및 공유는 이용자가 선택한 기능에 따라 이루어지며, 이를 모두 동일한 개인정보 제3자 제공이나 처리위탁으로 취급하지 않습니다.</p>
            <ul>
              <li>네이버 분석: 요청한 검색어와 분석 조건 등을 네이버 API에 전달하여 결과를 제공합니다.</li>
              <li>YouTube·TikTok·Instagram: URL 저장 시 공개 콘텐츠 정보를 확인하고, 영상·게시물을 열면 해당 플랫폼의 외부 플레이어 또는 페이지를 불러올 수 있습니다. 이 과정에서 플랫폼이 접속 IP, 브라우저 정보, 쿠키 등 접속에 필요한 정보를 직접 처리할 수 있습니다.</li>
              <li>카카오톡 공유: 이용자가 공유를 요청한 콘텐츠의 제목, 설명, 대표 이미지 및 상세 페이지 주소를 카카오 공유 기능에 전달합니다. 운영자가 이용자의 카카오톡 친구나 채팅방 목록을 직접 수집하지 않습니다.</li>
            </ul>
            <h3>주 저장 위치 및 국외 이전</h3>
            <p>현재 Supabase의 데이터베이스·인증·스토리지 주 저장 위치는 대한민국 서울(ap-northeast-2)입니다. Vercel의 서버 함수는 미국 워싱턴 D.C. 권역(iad1)에서 실행되므로, 서버 요청에 포함된 개인정보는 한국 데이터베이스에 저장되기 전에 미국 서버에서 처리될 수 있습니다. 한국에 데이터를 저장한다는 사실이 서비스의 모든 처리가 국내에서만 이루어진다는 의미는 아닙니다.</p>
            <div className="privacyTableWrap">
              <table>
                <thead><tr><th>구분</th><th>Vercel 서버 처리</th></tr></thead>
                <tbody>
                  <tr><td>이전받는 자·연락처</td><td>{PARTNERSHIP_TRANSFER_NOTICE.recipient}</td></tr>
                  <tr><td>국가</td><td>{PARTNERSHIP_TRANSFER_NOTICE.country}</td></tr>
                  <tr><td>이전 항목</td><td>요청한 기능에 필요한 회원 식별·인증 정보, 검색어·콘텐츠 URL·분석 조건, 등록·사용하는 API 키, 제휴 문의 입력값·동의 정보 및 접속 정보</td></tr>
                  <tr><td>목적</td><td>웹사이트 제공, 회원별 기능·분석·보관함 및 제휴 문의의 서버 처리</td></tr>
                  <tr><td>시기·방법</td><td>이용자가 해당 기능을 요청할 때 암호화된 네트워크 통신으로 전송</td></tr>
                  <tr><td>보유 기준</td><td>요청 데이터는 해당 기능 처리에 사용합니다. 문의 본문을 별도 로그로 기록하지 않습니다. 서비스 생성·보안 정보는 사업자가 해당 목적에 더 이상 필요하지 않을 때 삭제 또는 익명화합니다. 런타임 로그의 열람 기간은 Hobby 1시간, Pro 1일 등 요금제·추가 옵션에 따라 달라지며, 이는 사업자가 처리하는 모든 정보의 일괄 삭제 기한을 뜻하지 않습니다.</td></tr>
                  <tr><td>거부·철회</td><td>제휴 문의는 접수 화면에서 국외 이전 동의를 거부할 수 있으며 이 경우 온라인 제출이 제한됩니다. 철회·삭제 요청은 edenofcls@gmail.com으로 보낼 수 있습니다. 서버 처리가 필요한 회원·분석 기능의 이전을 원하지 않는 경우 해당 기능 이용을 중단하고 계정·저장정보 삭제를 요청할 수 있습니다.</td></tr>
                </tbody>
              </table>
            </div>
            <p>Supabase는 주 저장 지역 외에서도 지원·보안 대응, 운영 로그 및 콘텐츠 전송 등 제한된 업무를 처리할 수 있습니다. 운영자는 지원 문의 등에 회원 개인정보를 불필요하게 포함하지 않습니다. 이슈 대표 이미지 등 공개 콘텐츠는 전송망을 통해 다른 지역에서 제공될 수 있으며, 비공개 회원 보관함을 공개 이미지로 전송하지 않습니다.</p>
            <p>사업자별 세부 처리 조건은 <a href="https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq" target="_blank" rel="noopener noreferrer">Supabase의 데이터 위치·이전 안내</a> 및 <a href="https://vercel.com/legal/dpa" target="_blank" rel="noopener noreferrer">Vercel의 개인정보 처리계약</a>에서 확인할 수 있습니다. 저장·실행 지역이나 처리 업무가 변경되면 방침과 필요한 안내·동의 절차를 함께 변경합니다.</p>
            <p>외부 플랫폼의 개인정보 처리에 관한 내용은 각 사업자의 방침에서도 확인할 수 있습니다.</p>
            <ul>
              <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google 개인정보처리방침</a></li>
              <li><a href="https://policy.naver.com/policy/privacy.html" target="_blank" rel="noopener noreferrer">네이버 개인정보처리방침</a></li>
              <li><a href="https://www.tiktok.com/legal/page/row/privacy-policy/ko" target="_blank" rel="noopener noreferrer">TikTok 개인정보처리방침</a></li>
              <li><a href="https://privacycenter.instagram.com/policy/" target="_blank" rel="noopener noreferrer">Instagram 개인정보처리방침</a></li>
              <li><a href="https://www.kakao.com/policy/privacy" target="_blank" rel="noopener noreferrer">카카오 개인정보처리방침</a></li>
            </ul>
            <p>CONTENTS VIEW는 YouTube API 서비스를 이용합니다. YouTube 기능에는 <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube 서비스 약관</a>이 적용됩니다. API 키 등록은 이용자의 비공개 YouTube 계정 정보나 업로드 권한을 운영자에게 부여하는 절차가 아닙니다.</p>
          </section>

          <section id="storage">
            <h2>6. 쿠키와 브라우저 저장정보</h2>
            <p>로그인 상태 확인을 위한 인증 쿠키와 브라우저의 로컬·세션 저장소를 사용합니다. 브라우저에는 로그인 세션, 화면 테마, 공지 확인 상태, 비회원 급상승 영상 열람 횟수, 비회원 안내창 표시 여부 등이 저장될 수 있습니다. 일부 뉴스 목록도 세션 중 임시 저장됩니다.</p>
            <p>배너 닫기 설정은 브라우저에 저장되며 한국 시간 다음 날 00시부터 배너가 다시 표시됩니다. 설정값은 유효기간이 끝나도 브라우저 저장소에 남을 수 있습니다.</p>
            <p>YouTube·TikTok·Instagram 보관 항목은 로그인한 계정의 서버 데이터베이스에 저장됩니다. 브라우저 데이터를 지우는 것만으로 서버 보관함이 삭제되지는 않습니다. 이용자는 브라우저 설정에서 쿠키와 저장정보를 삭제하거나 차단할 수 있으나, 로그인 및 일부 편의 기능이 제한될 수 있습니다.</p>
            <p>사이트 안내 챗봇의 입력 내용과 답변은 현재 열린 화면의 메모리에서만 처리되며, 대화 내용을 서버에 저장하거나 외부 생성형 AI 서비스에 전송하지 않습니다. 새로고침하면 대화는 초기화됩니다. 챗봇에서 별도로 제휴 문의를 제출하는 경우에는 제휴 문의 항목에 따라 처리됩니다. 비밀번호, API 키 등 비밀정보는 대화에 입력하지 마세요.</p>
          </section>

          <section id="rights">
            <h2>7. 이용자의 권리와 행사 방법</h2>
            <p>이용자는 관련 법령에 따라 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지 등을 요청할 수 있습니다. 요청은 본인 확인 후 관계 법령에서 정한 절차에 따라 처리합니다.</p>
            <ul>
              <li>프로필 이름은 마이페이지에서 직접 수정할 수 있습니다.</li>
              <li>보관한 콘텐츠와 등록한 API 키는 해당 서비스 화면에서 개별 삭제할 수 있습니다.</li>
              <li>Google 계정과의 로그인 연결은 Google 계정 설정에서도 관리할 수 있습니다.</li>
              <li>계정 또는 서버에 저장된 정보의 삭제는 아래 개인정보 문의처로 요청할 수 있습니다.</li>
            </ul>
            <p>Google 로그인 연결 해제, API 키 삭제 및 CONTENTS VIEW 계정 삭제는 서로 다른 절차입니다. 외부 계정의 연결만 해제해도 CONTENTS VIEW의 보관함이 자동으로 삭제되지는 않습니다. 서버 저장정보까지 삭제하려면 개별 항목을 삭제하거나 계정 삭제를 요청해 주세요.</p>
            <p>법정대리인 또는 위임받은 대리인도 관련 법령에 따라 권리를 행사할 수 있으며, 이 경우 대리 권한을 확인하는 데 필요한 자료를 요청할 수 있습니다. 정정 또는 삭제 요청을 받은 정보는 관련 법령에 따라 필요한 조치를 취하며, 법령상 제한 사유로 요청을 처리할 수 없는 경우 그 사유를 안내합니다.</p>
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
              <li>운영자: 에덴 컴퍼니</li>
              <li>담당: 에덴 컴퍼니 CONTENTS VIEW 개인정보 보호 담당</li>
              <li>이메일: edenofcls@gmail.com</li>
            </ul>
            <p>문의 시에는 회신받을 이메일과 요청 내용을 알려 주세요. 주민등록번호, 계정 비밀번호 및 API 키 전체 값은 보내지 마세요. 본인 확인이 필요한 경우에만 필요한 추가 정보를 별도로 안내합니다.</p>
            <p>개인정보 침해에 대한 상담이나 분쟁조정은 <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener noreferrer">개인정보침해 신고센터</a> 또는 <a href="https://www.kopico.go.kr" target="_blank" rel="noopener noreferrer">개인정보 분쟁조정위원회</a>를 통해서도 신청할 수 있습니다.</p>
          </section>

          <section id="children">
            <h2>11. 만 14세 미만 아동의 개인정보</h2>
            <p>현재 만 14세 미만 아동을 위한 별도의 회원가입 및 법정대리인 동의 기능은 제공하지 않습니다. 법정대리인의 동의가 필요한 아동의 개인정보가 적법한 동의 없이 처리된 사실을 확인한 경우, 관련 법령에 따라 해당 정보의 삭제 등 필요한 조치를 취합니다. 법정대리인은 위 문의처로 열람·정정·삭제 및 처리정지 등을 요청할 수 있습니다.</p>
          </section>

          <section id="changes">
            <h2>12. 방침의 변경</h2>
            <p>방침이 변경되는 경우 시행 전에 웹사이트 공지 또는 이 페이지를 통해 변경 내용을 안내합니다. 이용자의 권리에 중대한 영향을 주는 변경은 충분한 기간을 두고 알립니다.</p>
          </section>
          <p className="privacyEffectiveDate">시행일: 2026.10.31</p>
      </article>
    </div>
  );
}
