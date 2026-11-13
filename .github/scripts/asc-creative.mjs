// Uploads the App Store header and search results art in
// store/ios/creative/<locale>/universal.png (16:9, 5244x2950, made with
// store/capture/hero.cjs) to the app's Asset Library, and places it on that
// language of the newest iOS version as both the product page header and the
// search results asset, replacing what that language had there. The art is
// reviewed with the version, or on its own through the Asset Library.
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 and BUNDLE_ID.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { asc, findApp } from "./asc-api.mjs";

const DIR = "store/ios/creative";
const TYPES = ["PRODUCT_PAGE_HEADER_ASSET", "APP_STORE_SEARCH_RESULTS_ASSET"];
const { BUNDLE_ID } = process.env;
if (!BUNDLE_ID) throw new Error("BUNDLE_ID is not set");

const app = await findApp(BUNDLE_ID);
const versions = (await asc("GET", `/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`)).data;
const version = versions.find((/** @type {any} */ v) => (v.attributes.appStoreState ?? v.attributes.appVersionState) !== "READY_FOR_SALE") ?? versions[0];
console.log(`${app.attributes.name}, version ${version.attributes.versionString} (${version.attributes.appVersionState ?? version.attributes.appStoreState})`);

/** @param {string} path */
const tryGet = async (path) => {
  try {
    return await asc("GET", path);
  } catch (e) {
    console.log(`(${/** @type {Error} */ (e).message.slice(0, 300)})`);
    return null;
  }
};

const lib = (await tryGet(`/apps/${app.id}/assetLibrary`))?.data;
const libId = lib?.id ?? app.id;
console.log(`Asset library ${libId}`);

// Placement groups and the specs each one takes, for placements that ask for a group.
const ref = await tryGet("/appAssetLibraryRefData");
console.log("Reference data:", JSON.stringify(ref).slice(0, 4000));
/** @type {any[]} */
const groups = (ref?.data ?? []).concat(ref?.included ?? []).filter((/** @type {any} */ r) => /group/i.test(r.type ?? "") || r.attributes?.specMappings);

const locs = (await asc("GET", `/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`)).data;
let summary = "";

for (const locale of (await readdir(DIR)).sort()) {
  const loc = locs.find((/** @type {any} */ l) => l.attributes.locale === locale);
  if (!loc) {
    console.log(`${locale}: the version has no such language, skipped`);
    continue;
  }
  const bytes = await readFile(join(DIR, locale, "universal.png"));
  const image = (await asc("POST", "/appAssetLibraryImages", {
    data: {
      type: "appAssetLibraryImages",
      attributes: { category: "CREATIVE_ASSETS", fileName: `hibira-${locale}.png`, fileSize: bytes.length },
      relationships: { assetLibrary: { data: { type: "appAssetLibraries", id: libId } } },
    },
  })).data;
  for (const op of image.attributes.uploadOperations) {
    const headers = Object.fromEntries(op.requestHeaders.map((/** @type {any} */ h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`upload ${locale}: ${res.status} ${await res.text()}`);
  }
  await asc("PATCH", `/appAssetLibraryImages/${image.id}`, {
    data: { type: "appAssetLibraryImages", id: image.id, attributes: { uploaded: true } },
  });
  let state = "";
  let attrs = {};
  for (let i = 0; i < 60; i++) {
    attrs = (await asc("GET", `/appAssetLibraryImages/${image.id}`)).data.attributes;
    state = /** @type {any} */ (attrs).state ?? /** @type {any} */ (attrs).assetDeliveryState?.state ?? "";
    if (!["AWAITING_UPLOAD", "UPLOAD_COMPLETE", ""].includes(state)) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  const { uploadOperations, ...shown } = /** @type {any} */ (attrs);
  console.log(`${locale}: image ${image.id} ${state}`, JSON.stringify(shown).slice(0, 600));
  if (state === "FAILED" || state === "REJECTED") throw new Error(`${locale}: image ${state}`);

  const old = (await tryGet(`/appStoreVersionLocalizations/${loc.id}/placements?limit=50`))?.data ?? [];
  for (const type of TYPES) {
    for (const p of old.filter((/** @type {any} */ p) => p.attributes?.placementType === type)) {
      await asc("DELETE", `/appAssetLibraryPlacements/${p.id}`);
    }
    const body = {
      data: {
        type: "appAssetLibraryPlacements",
        attributes: { placementType: type },
        relationships: {
          appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } },
          image: { data: { type: "appAssetLibraryImages", id: image.id } },
        },
      },
    };
    try {
      await asc("POST", "/appAssetLibraryPlacements", body);
    } catch (e) {
      // Some placements need a placement group: try the groups that take this image's spec.
      const spec = /** @type {any} */ (attrs).specId;
      const fits = groups.filter((g) => !spec || JSON.stringify(g.attributes?.specMappings ?? "").includes(spec));
      let placed = false;
      for (const g of fits) {
        const group = g.attributes?.placementGroup ?? g.attributes?.name ?? g.id;
        try {
          await asc("POST", "/appAssetLibraryPlacements", { data: { ...body.data, attributes: { placementType: type, placementGroup: group } } });
          console.log(`${locale}: ${type} placed in group ${group}`);
          placed = true;
        } catch (e2) {
          console.log(`${locale}: group ${group}: ${/** @type {Error} */ (e2).message.slice(0, 300)}`);
        }
      }
      if (!placed) throw e;
      continue;
    }
    console.log(`${locale}: ${type} placed`);
  }
  summary += `- ${locale}: header and search results art\n`;
}

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### App Store header and search results art for ${version.attributes.versionString}\n${summary}`);
}
