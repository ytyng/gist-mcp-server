import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  findConfigFile,
  getGitHubToken,
  loadConfig,
  mergeMapping,
  resetConfigCache,
  splitCommand,
} from "./config.ts";

const CONFIG_YAML_ENV_KEY = "GIST_MCP_SERVER_CONFIG_YAML";

// 設定は環境変数とプロセス内キャッシュに依存するので、毎回まっさらにする。
function withEnv(env: Record<string, string | null>, fn: () => Promise<void>) {
  const saved = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(env)) {
    saved.set(key, Deno.env.get(key));
    if (value === null) Deno.env.delete(key);
    else Deno.env.set(key, value);
  }
  resetConfigCache();

  return fn().finally(() => {
    for (const [key, value] of saved) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
    resetConfigCache();
  });
}

Deno.test("splitCommand splits on whitespace", () => {
  assertEquals(splitCommand("op read foo"), ["op", "read", "foo"]);
});

Deno.test("splitCommand keeps quoted arguments together", () => {
  assertEquals(
    splitCommand('op read "op://development/gist/config yaml"'),
    ["op", "read", "op://development/gist/config yaml"],
  );
  assertEquals(splitCommand("echo 'a b'"), ["echo", "a b"]);
});

Deno.test("splitCommand keeps an empty quoted argument", () => {
  assertEquals(splitCommand("cmd ''"), ["cmd", ""]);
});

Deno.test("splitCommand rejects unbalanced quotes", () => {
  assertThrows(() => splitCommand('op read "unclosed'), Error, "Unbalanced");
});

Deno.test("mergeMapping merges nested mappings recursively", () => {
  const merged = mergeMapping(
    { a: { x: 1, y: 2 }, b: "base" },
    { a: { y: 99 }, c: "over" },
  );
  assertEquals(merged, { a: { x: 1, y: 99 }, b: "base", c: "over" });
});

Deno.test("mergeMapping replaces lists and scalars wholesale", () => {
  // 配列は要素の同一性を判定できないため、マージせず置き換える
  const merged = mergeMapping(
    { list: [1, 2, 3], scalar: "old" },
    { list: [9], scalar: "new" },
  );
  assertEquals(merged, { list: [9], scalar: "new" });
});

Deno.test("loadConfig reads the config yaml from the environment", async () => {
  await withEnv(
    { [CONFIG_YAML_ENV_KEY]: "github_token: from-env-yaml" },
    async () => {
      assertEquals((await loadConfig()).github_token, "from-env-yaml");
    },
  );
});

Deno.test("loadConfig treats an empty document as an empty config", async () => {
  await withEnv({ [CONFIG_YAML_ENV_KEY]: "# comment only\n" }, async () => {
    assertEquals(await loadConfig(), {});
  });
});

Deno.test("loadConfig rejects a non-mapping config", async () => {
  await withEnv({ [CONFIG_YAML_ENV_KEY]: "- just\n- a list\n" }, async () => {
    await assertRejects(() => loadConfig(), Error, "must be a YAML mapping");
  });
});

Deno.test("loadConfig merges the output of config_override_command", async () => {
  const yaml = [
    "github_token: from-file",
    `config_override_command: 'echo "github_token: from-command"'`,
  ].join("\n");
  await withEnv({ [CONFIG_YAML_ENV_KEY]: yaml }, async () => {
    assertEquals((await loadConfig()).github_token, "from-command");
  });
});

Deno.test("loadConfig keeps local keys the command does not override", async () => {
  const yaml = [
    "github_token: from-file",
    `config_override_command: 'echo "other_key: from-command"'`,
  ].join("\n");
  await withEnv({ [CONFIG_YAML_ENV_KEY]: yaml }, async () => {
    assertEquals((await loadConfig()).github_token, "from-file");
  });
});

Deno.test("loadConfig does not follow a nested config_override_command", async () => {
  // 取得した YAML 側のキーを辿ると無限再帰になるので、マージ後に落とす。
  // ローカルの値がそのまま残る (取得側の 'echo nested' で上書きされない)
  const command = `echo "config_override_command: echo nested"`;
  const yaml = `config_override_command: '${command}'`;
  await withEnv({ [CONFIG_YAML_ENV_KEY]: yaml }, async () => {
    const config = await loadConfig();
    assertEquals(config.config_override_command, command);
    assertEquals(Object.keys(config), ["config_override_command"]);
  });
});

Deno.test("loadConfig rejects an empty config_override_command", async () => {
  await withEnv(
    { [CONFIG_YAML_ENV_KEY]: 'config_override_command: ""' },
    async () => {
      await assertRejects(() => loadConfig(), Error, "non-empty string");
    },
  );
});

Deno.test("loadConfig fails when config_override_command exits non-zero", async () => {
  await withEnv(
    { [CONFIG_YAML_ENV_KEY]: `config_override_command: 'false'` },
    async () => {
      await assertRejects(() => loadConfig(), Error, "non-zero status");
    },
  );
});

Deno.test("getGitHubToken prefers the GITHUB_TOKEN environment variable", async () => {
  await withEnv(
    {
      GITHUB_TOKEN: "from-env",
      // 設定ファイルを読まないことを確かめるため、読むと失敗する内容を置く
      [CONFIG_YAML_ENV_KEY]: "- broken",
    },
    async () => {
      assertEquals(await getGitHubToken(), "from-env");
    },
  );
});

Deno.test("getGitHubToken falls back to the config file", async () => {
  await withEnv(
    { GITHUB_TOKEN: null, [CONFIG_YAML_ENV_KEY]: "github_token: from-config" },
    async () => {
      assertEquals(await getGitHubToken(), "from-config");
    },
  );
});

Deno.test("getGitHubToken reports where to put the token", async () => {
  await withEnv(
    { GITHUB_TOKEN: null, [CONFIG_YAML_ENV_KEY]: "other_key: 1" },
    async () => {
      await assertRejects(() => getGitHubToken(), Error, "config.yaml");
    },
  );
});

Deno.test("getGitHubToken rejects a non-string github_token", async () => {
  // YAML は任意の型を返すので、数値やマッピングをトークンとして通さない
  await withEnv(
    { GITHUB_TOKEN: null, [CONFIG_YAML_ENV_KEY]: "github_token: 12345" },
    async () => {
      await assertRejects(() => getGitHubToken(), Error, "non-empty string");
    },
  );
});

Deno.test("an empty GIST_MCP_SERVER_CONFIG_YAML does not fall back to the file", async () => {
  // 空文字で無効化したつもりの時に実ファイルのトークンを拾わないこと
  await withEnv(
    { GITHUB_TOKEN: null, [CONFIG_YAML_ENV_KEY]: "" },
    async () => {
      assertEquals(await loadConfig(), {});
    },
  );
});

// --- 設定ファイルの探索 (HOME を差し替えて実ファイルを置く) ---

async function withConfigFiles(
  files: Record<string, string>,
  fn: (dir: string) => Promise<void>,
) {
  const home = await Deno.makeTempDir();
  const dir = `${home}/.config/gist-mcp-server`;
  await Deno.mkdir(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    await Deno.writeTextFile(`${dir}/${name}`, body);
    await Deno.chmod(`${dir}/${name}`, 0o600);
  }

  await withEnv(
    { HOME: home, GITHUB_TOKEN: null, [CONFIG_YAML_ENV_KEY]: null },
    () => fn(dir),
  ).finally(() => Deno.removeSync(home, { recursive: true }));
}

Deno.test("findConfigFile finds config.yaml", async () => {
  await withConfigFiles({ "config.yaml": "github_token: t\n" }, (dir) => {
    assertEquals(findConfigFile(), `${dir}/config.yaml`);
    return Promise.resolve();
  });
});

Deno.test("findConfigFile accepts the .yml spelling", async () => {
  await withConfigFiles({ "config.yml": "github_token: t\n" }, (dir) => {
    assertEquals(findConfigFile(), `${dir}/config.yml`);
    return Promise.resolve();
  });
});

Deno.test("config.yaml wins over config.yml", async () => {
  await withConfigFiles(
    {
      "config.yaml": "github_token: yaml\n",
      "config.yml": "github_token: yml\n",
    },
    async (dir) => {
      assertEquals(findConfigFile(), `${dir}/config.yaml`);
      assertEquals(await getGitHubToken(), "yaml");
    },
  );
});

Deno.test("findConfigFile returns null when no config file exists", async () => {
  await withConfigFiles({}, () => {
    assertEquals(findConfigFile(), null);
    return Promise.resolve();
  });
});

Deno.test("getGitHubToken reads the token from the config file", async () => {
  await withConfigFiles(
    { "config.yaml": "github_token: from-file\n" },
    async () => {
      assertEquals(await getGitHubToken(), "from-file");
    },
  );
});
