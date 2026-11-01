import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import MyPageModal from "../client/src/components/MyPageModal";

const state = vi.hoisted(() => ({
  exists: false,
  loading: false,
  error: null as Error | null,
  testStatus: "untested",
}));

vi.mock("../client/src/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { name: "Test member", email: "test@example.invalid" }, isAuthenticated: true }),
}));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: vi.fn() } } }),
    user: {
      updateName: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      apiKey: {
        getWithStatus: { useQuery: () => ({
          data: state.loading || state.error ? undefined : { exists: state.exists, maskedKey: state.exists ? "AIza****1234" : null, testStatus: state.testStatus, testError: null },
          isLoading: state.loading,
          error: state.error,
          refetch: vi.fn(),
        }) },
        save: { useMutation: () => ({ mutateAsync: vi.fn() }) },
        delete: { useMutation: () => ({ mutateAsync: vi.fn() }) },
        testConnection: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      },
    },
  },
}));

const render = () => renderToStaticMarkup(React.createElement(MyPageModal, { isOpen: true, onClose: vi.fn() }));

describe("my info API settings", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    state.exists = false;
    state.loading = false;
    state.error = null;
    state.testStatus = "untested";
  });
  afterAll(() => vi.unstubAllGlobals());

  it("shows the member grade above a registration button without key issuance help", () => {
    const html = render();
    expect(html).toContain("내 정보");
    expect(html).toContain("일반 회원");
    expect(html.indexOf("일반 회원")).toBeLessThan(html.indexOf("유튜브 API 키"));
    expect(html).toContain('aria-label="유튜브 API 키 등록"');
    expect(html).not.toContain("API 키 발급 방법 보기");
    expect(html).not.toContain('aria-label="유튜브 API 키 입력"');
  });

  it("shows edit rather than registration for an existing key", () => {
    state.exists = true;
    const html = render();
    expect(html).toContain('aria-label="유튜브 API 키 수정"');
    expect(html).not.toContain('aria-label="유튜브 API 키 등록"');
    expect(html).not.toContain("AIza****1234");
  });

  it("places the connection status between the label and action without exposing the saved key", () => {
    state.exists = true;
    state.testStatus = "success";
    const html = render();
    const label = html.indexOf('class="mypageModalLabel">유튜브 API 키');
    const status = html.indexOf("YouTube API 연결이 확인되었습니다.");
    const action = html.indexOf('aria-label="유튜브 API 키 수정"');
    expect(label).toBeLessThan(status);
    expect(status).toBeLessThan(action);
    expect(html).not.toContain("AIza****1234");
  });

  it("disables key changes while the saved state is being checked", () => {
    state.loading = true;
    expect(render()).toMatch(/disabled=""[^>]*>확인 중/);
  });

  it("offers a retry instead of allowing changes after a lookup failure", () => {
    state.error = new Error("Lookup failed");
    const html = render();
    expect(html).toContain("다시 확인");
    expect(html).toMatch(/disabled=""[^>]*aria-label="유튜브 API 키 등록"/);
  });
});
