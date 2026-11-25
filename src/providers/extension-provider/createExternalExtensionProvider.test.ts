
import { StreamProvider } from "../StreamProvider";
import { MockPort } from "../test/mocks/MockPort";
import { createExternalExtensionProvider } from "./createExternalExtensionProvider";
import config from "./external-extension-config.json";

describe("createExternalExtensionProvider", () => {
  beforeEach(() => {
    global.chrome = {
      // @ts-ignore
      runtime: {
        connect: jest.fn(),
      },
    };
  });

  it("can be called and not throw", () => {
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    expect(() => createExternalExtensionProvider()).not.toThrow();
  });

  it("calls connect", () => {
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    createExternalExtensionProvider();
    expect(global.chrome.runtime.connect).toHaveBeenCalled();
  });

  it("returns a stream provider", () => {
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    const results = createExternalExtensionProvider();
    expect(results).toBeInstanceOf(StreamProvider);
  });

  it("supports Flask", () => {
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    const results = createExternalExtensionProvider("flask");
    expect(results).toBeInstanceOf(StreamProvider);
    expect(global.chrome.runtime.connect).toHaveBeenCalledWith(
      config.chromeIds.flask
    );
  });

  it("supports Beta", () => {
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    const results = createExternalExtensionProvider("beta");
    expect(results).toBeInstanceOf(StreamProvider);
    expect(global.chrome.runtime.connect).toHaveBeenCalledWith(
      config.chromeIds.beta
    );
  });

  it("supports custom extension ID", () => {
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    const results = createExternalExtensionProvider("foobar");
    expect(results).toBeInstanceOf(StreamProvider);
    expect(global.chrome.runtime.connect).toHaveBeenCalledWith("foobar");
  });

});
