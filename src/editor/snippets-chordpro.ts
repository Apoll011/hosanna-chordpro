export async function registerChordproSnippets(aceInstance?: any): Promise<void> {
  let ace = aceInstance;
  if (!ace) {
    try {
      const mod = await import("ace-builds");
      ace = (mod as any).default || mod;
    } catch {
      return;
    }
  }

  if (!ace || typeof ace.define !== "function" || (ace as any)._chordproSnippetsRegistered) {
    return;
  }

  (ace as any).define(
    "ace/snippets/chordpro",
    ["require", "exports", "module"],
    (_: any, exports: any) => {
      exports.snippetText = [
        // album tag
        "snippet album",
        "	{album: ${1:value}}",

        "snippet youtube",
        "	{youtube: ${1:url}}",

        "snippet number",
        "	{song_number: ${1:number}}",

        "snippet cc",
        "	{chorus}",

        // arranger tag
        "snippet arranger",
        "	{arranger: ${1:value}}",

        // artist tag
        "snippet a",
        "	{artist: ${1:value}}",
        "snippet artist",
        "	{artist: ${1:value}}",

        // capo tag
        "snippet capo",
        "	{capo: ${1:5}}",

        // composer tag
        "snippet composer",
        "	{composer: ${1:value}}",

        // copyright tag
        "snippet copyright",
        "	{copyright: ${1:value}}",

        // duration tag
        "snippet duration",
        "	{duration: ${1:4}:${2:00}}",

        // key tag
        "snippet k",
        "	{key: ${1:Am}}",
        "snippet key",
        "	{key: ${1:Am}}",

        // lyricist tag
        "snippet lyricist",
        "	{lyricist: ${1:value}}",

        // tempo tag
        "snippet tempo",
        "	{tempo: ${1:120}}",

        // time tag
        "snippet time",
        "	{time: ${1:4}/${2:4}}",

        // title tag
        "snippet t",
        "	{title: ${1:value}}",
        "snippet title",
        "	{title: ${1:value}}",

        // subtitle tag
        "snippet st",
        "	{subtitle: ${1:value}}",
        "snippet subtitle",
        "	{subtitle: ${1:value}}",

        // year tag
        "snippet year",
        "	{year: ${1:2020}}",

        // meta tag
        "snippet meta",
        "	{meta: ${1:label} ${2:value}}",

        // comment tag
        "snippet c",
        "	{comment: ${1:value}}",
        "snippet comment",
        "	{comment: ${1:value}}",

        // chorus block
        "snippet soc",
        "	{start_of_chorus}",
        "snippet eoc",
        "	{end_of_chorus}",
        "snippet chorus",
        "	{start_of_chorus: ${1:Refrão}}",
        "	${2:lyrics}",
        "	{end_of_chorus}",

        // verse block
        "snippet sov",
        "	{start_of_verse}",
        "snippet eov",
        "	{end_of_verse}",
        "snippet verse",
        "	{start_of_verse: ${1:Verso} ${2:1}}",
        "	${3:lyrics}",
        "	{end_of_verse}",

        // bridge block
        "snippet sob",
        "	{start_of_bridge}",
        "snippet eob",
        "	{end_of_bridge}",
        "snippet bridge",
        "	{start_of_bridge: ${1:Ponte}}",
        "	${2:lyrics}",
        "	{end_of_bridge}",

        // tabs block
        "snippet sot",
        "	{start_of_tab}",
        "snippet eot",
        "	{end_of_tab}",
        "snippet tab",
        "	{start_of_tab}",
        "	e|-${1:-}--------------------------------|",
        "	B|----------------------------------|",
        "	G|----------------------------------|",
        "	D|----------------------------------|",
        "	A|----------------------------------|",
        "	E|----------------------------------|",
        "	{end_of_tab}",

        // version block
        "snippet version",
        "	{start_of_version: ${1:Nome da Versão}}",
        "	${2:}",
        "	{end_of_version}",

        // define tag
        "snippet d",
        "	{define: ${1:Am} base-fret ${2:1} frets ${3:0 0 0 0 0 0} fingers ${4:0 0 0 0 0 0}}",
        "snippet define",
        "	{define: ${1:Am} base-fret ${2:1} frets ${3:0 0 0 0 0 0} fingers ${4:0 0 0 0 0 0}}",

        // single-liners
        "snippet cb",
        "	{column_break}",
        "snippet column",
        "	{column_break}",

        // that's all folks!
        // chord usage
        "snippet [",
        "\t[${1:Am}]",

        // chord section / grid notation
        "snippet ||",
        "\t||[${1:Am}]|[${2:C}]|[${3:G}]|[${4:F}]||",

        "snippet grid",
        "\t{start_of_grid}",
        "\t||[${1:Em}]|[${2:C}]|[${3:D}]||",
        "\t{end_of_grid}",

        "snippet !",
        "\t{title: ${1:value}}",
        "\t{artist: ${2:value}}",
        "\t{duration: ${3:4:00}}",
        "\t{key: ${4:C}}",
        "\t",
        "\t${5:lyrics}",
        "\t{start_of_chorus}",
        "\t${6:lyrics}",
        "	{end_of_chorus}",
      ].join("\n");
      exports.scope = "chordpro";
    },
  );

  (ace as any)._chordproSnippetsRegistered = true;
}
