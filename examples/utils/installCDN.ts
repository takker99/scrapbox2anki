export interface InstallInit {
  id: string;
  module?: boolean;
}

export const installCDN = (src: string, init: InstallInit): Promise<void> =>
  new Promise((resolve, reject) => {
    const { id, module = false } = init;
    const oldScript = document.getElementById(id);
    oldScript?.remove();

    const script = document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", (e) => reject(e));
    script.src = src;
    script.id = id;
    if (module) script.type = "module";
    document.head.append(script);
  });
