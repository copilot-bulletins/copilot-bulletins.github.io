(function (root, factory) {
  const routes = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = routes;
    if (require.main === module) {
      const input = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
      const mode = process.argv[2] || "identity";
      let output;
      if (mode === "identity") {
        output = routes.identity(input.entry, input.manifest);
      } else if (mode === "rss") {
        output = input.map(entry => ({ ...entry, webPath: routes.path(entry, input) }));
      } else {
        throw new Error(`Unknown bulletin routing mode: ${mode}`);
      }
      process.stdout.write(JSON.stringify(output));
    }
  } else {
    root.BulletinRoutes = routes;
  }
})(globalThis, function () {
  const codes = { english: "en", french: "fr", spanish: "es" };
  const languages = { en: "english", fr: "french", es: "spanish" };
  function validate(entry) {
    if (!codes[entry.language] || !["biweekly", "monthly", "monthly-long", "on-demand"].includes(entry.period) ||
        !["devs", "admins", "decision-makers"].includes(entry.audience) ||
        !Number.isSafeInteger(entry.edition) || entry.edition < 1 ||
        !Number.isSafeInteger(entry.number) || entry.number < 1) {
      throw new Error("Invalid bulletin publication identity");
    }
  }
  function sameGroup(a, b) {
    return a.language === b.language && a.period === b.period && a.audience === b.audience;
  }
  function identity(entry, manifest) {
    validate(entry);
    const collisions = manifest.filter(other =>
      other.number !== entry.number && sameGroup(other, entry) && other.edition === entry.edition);
    collisions.forEach(validate);
    const latestNumber = Math.max(entry.number, ...collisions.map(other => other.number));
    const suffix = collisions.length ? "-" + entry.number : "";
    const hash = "#" + codes[entry.language] + "/" + entry.period + "/" + entry.audience + "/" + entry.edition +
      (entry.number !== latestNumber ? "/" + entry.number : "");
    return {
      file: "bulletins/" + entry.language + "/" + entry.period + "/" + entry.audience + "/" +
        entry.edition + suffix + ".html",
      hash,
    };
  }
  function path(entry, manifest) {
    return identity(entry, manifest).hash;
  }
  function findEntry(hash, manifest) {
    const parts = hash.replace(/^#/, "").split("/");
    if (![4, 5].includes(parts.length) || !languages[parts[0]] ||
        !/^[1-9]\d*$/.test(parts[3]) || (parts.length === 5 && !/^[1-9]\d*$/.test(parts[4]))) return undefined;
    const edition = Number(parts[3]);
    const number = parts.length === 5 ? Number(parts[4]) : null;
    if (!Number.isSafeInteger(edition) || (number !== null && !Number.isSafeInteger(number))) return undefined;
    const matches = manifest.filter(entry =>
      entry.language === languages[parts[0]] && entry.period === parts[1] && entry.audience === parts[2] &&
      entry.edition === edition && (number === null || entry.number === number));
    return matches.sort((a, b) => b.number - a.number)[0];
  }
  function siblings(entry, manifest) {
    return manifest.filter(other => sameGroup(other, entry)).sort((a, b) => b.number - a.number);
  }
  return { identity, path, findEntry, siblings };
});
