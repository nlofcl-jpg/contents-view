import { describe, expect, it } from "vitest";
import { getSupportReply, supportMenuQuestions, supportQuestions, trendTabQuestions } from "../client/src/lib/supportGuide";

describe("support guide", () => {
  it("answers every quick question", () => {
    for (const question of supportQuestions) {
      const reply = getSupportReply(question);
      expect(Boolean(reply.actions?.length || reply.questions?.length)).toBe(true);
    }
  });
  it("provides a dedicated guide and working destination for every menu", () => {
    expect(getSupportReply("메뉴별 사용법").questions).toEqual(supportMenuQuestions);
    for (const question of supportMenuQuestions) {
      expect(getSupportReply(question).actions?.length).toBeGreaterThan(0);
      expect(getSupportReply(question).text).not.toContain("기본 안내를 찾지 못했습니다");
    }
  });
  it("keeps account help separate from the main service menu", () => {
    expect(supportMenuQuestions).toHaveLength(6);
    expect(supportMenuQuestions).not.toContain("내 보관함 사용법");
    expect(supportQuestions).toContain("보관함");
    expect(supportQuestions).toContain("API 키 설정");
  });
  it("routes API key questions to the profile setup instructions", () => {
    const reply = getSupportReply("유튜브 API 키는 로그인 후 어디서 등록하나요?");
    expect(reply.text).toContain("마이페이지");
    expect(reply.text).toContain("YouTube API key");
    expect(reply.text).toContain("채팅창이나 문의 이메일에 보내지 마세요");
    expect(reply.questions).toEqual(["유튜브 트렌드 사용법", "유튜브 API 키 받는 법"]);
  });
  it("opens key issuance instructions instead of repeating key registration help", () => {
    const reply = getSupportReply("유튜브 API 키 받는 법");
    expect(reply.text).toContain("Google Cloud Console");
    expect(reply.text).toContain("사용자 인증 정보 만들기 → API 키");
    expect(reply.questions).toContain("API 키 설정");
    expect(getSupportReply("유튜브 트렌드 사용법").questions).toEqual(trendTabQuestions.youtube);
  });
  it("provides the correct child tabs for each trend overview", () => {
    expect(getSupportReply("유튜브 트렌드 사용법").questions).toEqual(trendTabQuestions.youtube);
    expect(getSupportReply("네이버 트렌드 사용법").questions).toEqual(trendTabQuestions.naver);
    expect(getSupportReply("검색 트렌드 사용법").questions).toEqual(trendTabQuestions.search);
  });
  it("resolves every tab and nested mode to a specific guide", () => {
    const questions = Object.values(trendTabQuestions).flat();
    questions.push(...getSupportReply("네이버 컨텐츠 사용법").questions!);
    for (const question of questions) {
      const reply = getSupportReply(question);
      expect(reply.text).toContain("활용");
      expect(reply.actions?.length).toBeGreaterThan(0);
    }
  });
  it("keeps search trend help focused on usage rather than collection internals", () => {
    for (const question of ["검색 트렌드 사용법", ...trendTabQuestions.search]) {
      expect(getSupportReply(question).text).not.toMatch(/수집|데이터 출처|서버|사이트에 등록/);
    }
  });
  it("explains authentication without claiming guest analysis is available", () => {
    expect(getSupportReply("유튜브 영상 분석 방법").text).toContain("실행하려면 로그인이 필요");
  });
  it("does not claim that studio mockups generate videos", () => {
    expect(getSupportReply("스튜디오 사용법").text).toContain("실제 영상을 생성하는 기능은 아직 제공하지 않습니다");
  });
  it("discloses that AI and human handoff are not live", () => {
    expect(getSupportReply("AI 상담").text).toContain("생성형 AI가 답변하는 채팅은 아닙니다");
    expect(getSupportReply("문의하기").text).toContain("자동 전달되지 않습니다");
  });
  it("uses the current contact address and real partnership form", () => {
    expect(getSupportReply("문의하기").actions).toContainEqual({ label: "이메일 문의", href: "mailto:edenofcls@gmail.com" });
    expect(getSupportReply("문의하기").actions).toContainEqual({ label: "제휴 문의 작성", inquiry: true });
  });
  it("handles unmatched questions without inventing answers", () => {
    expect(getSupportReply("xyz123").text).toContain("기본 안내를 찾지 못했습니다");
  });
});
