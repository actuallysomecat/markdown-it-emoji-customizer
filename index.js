import { globby } from 'globby'
import path from 'node:path/posix'

import fullData from 'markdown-it-emoji/lib/data/full.mjs'
import lightData from 'markdown-it-emoji/lib/data/light.mjs'
import defaultShortcuts from 'markdown-it-emoji/lib/data/shortcuts.mjs'

import { bare as MarkdownItEmoji } from 'markdown-it-emoji'

// ## -- FUNCTIONS --

/**
 * scan the given directory for emoji (image files) and return an object mapping of
 * each image’s basename (without extension) as key, and the site URL (by prepending baseUrl) as value
 *
 * @param {string} emojiDir - root emoji directory to scan, like "/img/emoji/" (the default)
 * @param {string} baseUrl - URL prefix to prepend to the value, like "/img/emoji/" (the default)
 * @returns {Promise<Object>} - example: { "blobcat": "/img/emoji/blobcat.png", "neocat_neocat_3c": "/img/emoji/neocat/neocat_neocat_3c.png", ... }
 */
export async function scanEmoji(emojiDir, baseUrl) {
  // the allowed extensions for the scan
  const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg']
  // match any file with any name and any extension from the allowedExtensions, including subdirs
  const pattern = `**/*.+(${allowedExtensions.join('|')})`
  // wait for globby to use the pattern in imagesDirectory
  const files = await globby(pattern, { cwd: emojiDir })

  const images = {}
  // for each image file
  files.forEach((file) => {
    // the parsed file path
    const parsed = path.parse(file)

    // if in a nested subdir, use only the last part of the chain
    // (this bit uses 'collection' because of how obsidian-icon-shortcodes does custom emoji in collections)
    // (it is assumed that any subdir of emoji will also be set as a collection in obsidian-icon-shortcodes)
    let collection = ''
    // if there is a parsed dir (there should be!)
    if (parsed.dir) {
      // the 'collection name' is assumed to be the last dir in the path,
      // so split the path into parts and pop off the last one as 'collection'
      collection = parsed.dir.split('/').pop()
    }

    // * use subdir_emojiName format if there is a subdir
    // this helps compatibility with the shortcode convention of the obsidian plugin 'obsidian-icon-shortcodes':
    // https://github.com/aidenlx/obsidian-icon-shortcodes
    // in that plugin, emoji in collections get the collection name prepended to the emoji name with an underscore.
    // the idea is that each subdir of emoji should also be a 'collection' in 'obsidian-icon-shortcodes',
    // such that a collection in the obsidian plugin named 'neocat' would contain all the emoji in '/img/emoji/neocat/',
    // so that shortcodes in obsidian would be like :neocat_neocat: (:collection_emojiName:)
    const key = collection ? `${collection}_${parsed.name}` : parsed.name
    // determine the prefix based on baseUrl
    const prefix = baseUrl !== '' ? baseUrl : './'
    // set the value to the prefix plus the file path
    images[key] = prefix + file
  })
  // console.warn(
  //   '-- scanned custom emoji definitions:',
  //   JSON.stringify(images, null, 2),
  // )
  return images
}

/**
 * customizes the markdown-it emoji renderer on the given markdown-it instance.
 *
 * (normally called internally by the main function of the plugin)
 *
 * @param {Object} md - the markdown-it instance (`md`) to customize
 * @param {Object} [options={}] - config options
 * @param {string} [options.baseUrl='/img/emoji/'] - the base url on the site of the root emoji dir
 * @param {Object|Function} [options.customEmojiImgAttributes={}] - HTML attributes to put in the `<img>` tag for custom emoji. can be **object** or **function**.
 *
 *  *as a **function**, it takes two parameters (**Objects**)*:
 *    - `emojiMeta` **{Object}** - md metadata of the emoji:
 *      - - `emojiName` {string} - the name of the emoji (filename, no extension, no path)
 *      - - `emojiType` {string} - the type ('custom' or 'unicode')
 *      - - `emojiSubdir` {string} - the parent dir of the emoji (or empty string if unicode)
 *      - - `rawShortcode` {string} - the raw shortcode (e.g. ':cat:')
 *    * `defaultAttrs` **{Object}** - the default attributes of the `<img>` tag:
 *      - - { alt: 'emoji: `${emojiName}`', class: 'custom-emoji--img', 'eleventy:ignore': true }
 *      - - - resulting in attributes like 'alt="emoji: neocat", 'class="custom-emoji--img", "eleventy:ignore"=""'
 *      - - - - (NOTE: the `eleventy:ignore` attr is removed by 11ty at build)
 *
 * @param {string} [options.customEmojiSpanClass='custom-emoji--span'] - class name for the `<span>` that wraps the `<img>` of custom emoji
 * @param {string} [options.unicodeEmojiSpanClass='unicode-emoji--span'] - class name for the `<span>` that wraps unicode emoji
 */
export function customizeEmojiRenderer(
  md,
  {
    baseUrl = '/img/emoji/',
    customEmojiImgAttributes = {},
    customEmojiSpanClass = 'custom-emoji--span',
    unicodeEmojiSpanClass = 'unicode-emoji--span',
    isEleventy = false,
  } = {},
) {
  // * override the emoji renderer
  md.renderer.rules.emoji = function (tokens, idx, options, env, self) {
    // get the content from the current token's markup
    const content = tokens[idx].content
    const isCustomEmoji = content.startsWith(baseUrl)
    // the emoji metadata
    // parse the name (no pathing, no extension) as emojiName
    const emojiName = path.parse(content).name
    let emojiMeta = {
      emojiName, // 'neocat'
      emojiFilename: content,
      emojiSubdir: path.basename(path.dirname(content)), // the subdir of the emoji, aka 'collection', like 'neocat' for '/img/neocat/neocat.png'
      rawShortcode: tokens[idx].markup, // ':shortcode:'
    }
    if (isCustomEmoji) {
      // * build default attributes (alt text, class), can override
      const defaultImgAttributes = {
        alt: `emoji: ${emojiName}`,
        class: 'custom-emoji--img',
      }
      // if isEleventy, use eleventy:ignore
      if (isEleventy) {
        defaultImgAttributes['eleventy:ignore'] = true
      }

      // * check if customEmojiImgAttributes is an object or function:
      // - if it's a function, use it.
      // - otherwise, it's probably an object, use it.
      // - (if undefined or worse, use an empty object, resulting in defaults)
      let customAttrs =
        (typeof customEmojiImgAttributes === 'function'
          ? customEmojiImgAttributes(emojiMeta, defaultImgAttributes)
          : customEmojiImgAttributes) || {}

      // * make extra sure customAttrs is an object now:
      // - if it's not an object, or is an array, or is null...
      if (
        typeof customAttrs !== 'object' ||
        Array.isArray(customAttrs) ||
        customAttrs === null
      ) {
        // ... then make it an empty object
        customAttrs = {}
        // error (complain about it)
        console.error(
          '- customEmojiImgAttributes is not an object! falling back to default attributes!',
        )
      }

      // * merge the customAttrs over defaultImgAttributes as finalAttributes
      const finalAttributes = {
        ...defaultImgAttributes,
        ...customAttrs,
      }

      // * convert the attributes to a string
      // - filter the object for non-false/non-null values
      // - for bools set as true, add that attribute as a flag
      // - otherwise just add the key and value as 'key="value"'
      // - join them all together with a space
      const attrsStr = Object.entries(finalAttributes)
        .filter(([key, value]) => value !== false && value !== null)
        .map(([key, value]) => (value === true ? key : `${key}="${value}"`))
        .join(' ')

      // * return a <span> with a custom emoji class, wrapping an <img> that has src and attributes
      return `<span class="${customEmojiSpanClass}"><img src="${content}" ${attrsStr} /></span>`
    }

    // * return a <span> with a unicode emoji class, wrapping the unicode emoji
    return `<span class="${unicodeEmojiSpanClass}">${content}</span>`
  }
}

// ## -- MAIN --

/**
 * default export for the plugin
 *
 * Options:
 * @param {Object} eleventyConfig - (*ignore*) - the 11ty config (provided by 11ty when using `addPlugin()` to initialize this plugin)
 * @param {Object} [options={}] - options for customizing the **markdownItEmojiCustomizer**
 * @param {Object} options.md - (*required*) the `md` markdown library from 11ty, passed in (*before* being set with `setLibrary()` in 11ty)
 * @param {string} [options.emojiDir='./public/img/emoji/'] - local dir to scan for emoji (this path is relative to the 11ty project)
 * @param {string} [options.baseUrl='/img/emoji'] - the base URL on the site for the root emoji dir (this path is relative to the output site)
 * @param {boolean} [options.mergeDefs=true] - bool option to merge the custom emoji definitions with the defaults
 * @param {string} [options.baseUnicodeEmojiSet='full'] - which default standard emoji set to use ('full', 'light', or 'bare')
 * @param {Object|Function} [options.customEmojiImgAttributes={}] - attributes to put in the `<img>` tag for custom emoji, or a function that returns such object.
 *  - will be merged over default attributes of { alt: `emoji: ${emojiName}`, class: 'custom-emoji--img', 'eleventy:ignore':true }
 * @param {string} [options.customEmojiSpanClass='custom-emoji--span'] - the class name for the `<span>` that wraps custom emoji `<img>` tags
 * @param {string} [options.unicodeEmojiSpanClass='unicode-emoji--span'] - the class name for the `<span>` that wraps unicode emoji
 * @param {boolean|Object} [options.shortcuts=false] - `true` = use the default shortcuts, `false` = don't, `object{}` = use an object for custom shortcuts
 * @param {boolean} [options.mergeShortcuts=true] - `true` = merge the custom shortcuts with the default
 * @param {string[]} [options.allowedEmoji] - an allowlist array of emoji shortcodes (only these will be processed)
 */
async function markdownItEmojiCustomizer(eleventyConfig, options = {}) {
  const {
    md,
    emojiDir = './public/img/emoji/',
    baseUrl = '/img/emoji/',
    mergeDefs = true,
    baseUnicodeEmojiSet = 'full',
    customEmojiImgAttributes = {},
    customEmojiSpanClass = 'custom-emoji--span',
    unicodeEmojiSpanClass = 'unicode-emoji--span',
    shortcuts = false,
    mergeShortcuts = true,
    allowedEmoji,
  } = options

  // ! make sure markdown-it instance (md) is provided!
  if (!md) {
    throw new Error(
      '-- markdown-it-emoji-customizer: The markdown-it instance (md) must be provided in the options!',
    )
  }

  // * scan the emojiDir for images and build the emojiDefs
  const customEmojiDefs = await scanEmoji(emojiDir, baseUrl)

  // * figure out which base unicode defs to use, if any
  let baseDefs
  // switch by 'baseUnicodeEmojiSet' option
  switch (baseUnicodeEmojiSet) {
    // light
    case 'light':
      baseDefs = lightData
      break
    // bare
    case 'none':
      baseDefs = {}
      break
    // full or anything else
    default:
      baseDefs = fullData
      break
  }

  // * default shortcuts (true/false) or custom shortcuts (Object)
  let baseShortcuts
  // switch by 'shortcuts' option
  switch (typeof shortcuts) {
    case 'boolean':
      // if true, use the default shortcuts as a base, if false then use empty object (no shortcuts as a base)
      baseShortcuts = shortcuts ? defaultShortcuts : {}
      break
    case 'object':
      // if it's an object mapping custom shortcuts like the default one's format, use it as a base
      baseShortcuts = shortcuts
      break
    default:
      // if not an object, assume no shortcuts
      baseShortcuts = {}
      break
  }

  // * if mergeDefs = true, merge customEmojiDefs over baseDefs
  const finalDefs = mergeDefs
    ? { ...baseDefs, ...customEmojiDefs }
    : customEmojiDefs

  // * if mergeShortcuts = true, merge baseShortCuts over defaultShortcuts, if false = use either the user-provided ones or none if none were provided
  const finalShortcuts = mergeShortcuts
    ? { ...defaultShortcuts, ...baseShortcuts }
    : baseShortcuts

  // * start compiling the markdownItEmoji options, finally
  const markdownItEmojiOptions = {
    defs: finalDefs,
  }

  // if there is an array of allowedEmoji, put them in the options
  if (Array.isArray(allowedEmoji)) {
    markdownItEmojiOptions.enabled = allowedEmoji
  }

  // if there are any shortcuts, put them in the options
  if (Object.keys(finalShortcuts).length > 0) {
    markdownItEmojiOptions.shortcuts = finalShortcuts
  }

  // * finally, use the thing on the thing with the things
  md.use(MarkdownItEmoji, markdownItEmojiOptions)

  // * update the markdown-it instance's emoji renderer.
  customizeEmojiRenderer(md, {
    baseUrl,
    customEmojiImgAttributes,
    customEmojiSpanClass,
    unicodeEmojiSpanClass,
    isEleventy: eleventyConfig !== null,
  })
}

export default markdownItEmojiCustomizer
