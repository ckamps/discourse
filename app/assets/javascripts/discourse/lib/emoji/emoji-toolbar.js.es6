import groups from 'discourse/lib/emoji/emoji-groups';

const PER_ROW = 12, PER_PAGE = 60;
let ungroupedIcons, recentlyUsedIcons;

try {
  if (localStorage && !localStorage.emojiUsage) { localStorage.emojiUsage = "{}"; }
} catch(e){
/* localStorage can be disabled, or cookies disabled, do not crash script here
 * TODO introduce a global wrapper for dealing with local storage
 * */
}

function closeSelector() {
  $('.emoji-modal, .emoji-modal-wrapper').remove();
  $('body, textarea').off('keydown.emoji');
}

function initializeUngroupedIcons() {
  const groupedIcons = {};

  groups.forEach(group => {
    group.icons.forEach(icon => groupedIcons[icon] = true);
  });

  ungroupedIcons = [];
  const emojis = Discourse.Emoji.list();
  emojis.forEach(emoji => {
    if (groupedIcons[emoji] !== true) {
      ungroupedIcons.push(emoji);
    }
  });

  if (ungroupedIcons.length) {
    groups.push({name: 'ungrouped', icons: ungroupedIcons});
  }
}

function trackEmojiUsage(title) {
  const recent = JSON.parse(localStorage.emojiUsage);

  if (!recent[title]) { recent[title] = { title: title, usage: 0 }; }
  recent[title]["usage"]++;

  localStorage.emojiUsage = JSON.stringify(recent);

  // clear the cache
  recentlyUsedIcons = null;
}

function sortByUsage(a, b) {
  if (a.usage > b.usage) { return -1; }
  if (b.usage > a.usage) { return 1; }
  return a.title.localeCompare(b.title);
}

function initializeRecentlyUsedIcons() {
  recentlyUsedIcons = [];

  const usage = _.map(JSON.parse(localStorage.emojiUsage)).sort(sortByUsage);
  const recent = usage.slice(0, PER_ROW);

  if (recent.length > 0) {

    recent.forEach(emoji => recentlyUsedIcons.push(emoji.title));

    const recentGroup = groups.findProperty('name', 'recent');
    if (recentGroup) {
      recentGroup.icons = recentlyUsedIcons;
    } else {
      groups.push({ name: 'recent', icons: recentlyUsedIcons });
    }
  }
}

function toolbar(selected) {
  if (!ungroupedIcons) { initializeUngroupedIcons(); }
  if (!recentlyUsedIcons) { initializeRecentlyUsedIcons(); }

  return groups.map((g, i) => {
    let icon = g.tabicon;
    let title = g.fullname;
    if (g.name === "recent") {
      icon = "star";
      title = "Recent";
    } else if (g.name === "ungrouped") {
      icon = g.icons[0];
      title = "Custom";
    }

    return { src: Discourse.Emoji.urlFor(icon),
             title,
             groupId: i,
             selected: i === selected };
  });
}

function bindEvents(page, offset, options) {
  const composerController = Discourse.__container__.lookup('controller:composer');

  $('.emoji-page a').click(() => {
    const title = $(this).attr('title');
    trackEmojiUsage(title);

    const prefix = options.skipPrefix ? "" : ":";
    composerController.appendTextAtCursor(`${prefix}${title}:`, {space: !options.skipPrefix});
    closeSelector();
    return false;
  }).hover(() => {
    const title = $(this).attr('title');
    const html = "<img src='" + Discourse.Emoji.urlFor(title) + "' class='emoji'> <span>:" + title + ":<span>";
    $('.emoji-modal .info').html(html);
  }, () => $('.emoji-modal .info').html(""));

  $('.emoji-modal .nav .next a').click(() => render(page, offset+PER_PAGE, options));
  $('.emoji-modal .nav .prev a').click(() => render(page, offset-PER_PAGE, options));

  $('.emoji-modal .toolbar a').click(function(){
    const p = parseInt($(this).data('group-id'));
    render(p, 0, options);
    return false;
  });
}

function render(page, offset, options) {
  localStorage.emojiPage = page;
  localStorage.emojiOffset = offset;

  const toolbarItems = toolbar(page);
  const rows = [];
  let row = [];
  const icons = groups[page].icons;
  const max = offset + PER_PAGE;

  for(let i=offset; i<max; i++){
    if(!icons[i]){ break; }
    if(row.length === PER_ROW){
      rows.push(row);
      row = [];
    }
    row.push({src: Discourse.Emoji.urlFor(icons[i]), title: icons[i]});
  }
  rows.push(row);

  const model = {
    toolbarItems: toolbarItems,
    rows: rows,
    prevDisabled: offset === 0,
    nextDisabled: (max + 1) > icons.length
  };

  $('body .emoji-modal').remove();
  const rendered = Ember.TEMPLATES["emoji-toolbar.raw"](model);
  $('body').append(rendered);

  bindEvents(page, offset, options);
}

function showSelector(options) {
  options = options || {};

  $('body').append('<div class="emoji-modal-wrapper"></div>');
  $('.emoji-modal-wrapper').click(() => closeSelector());

  const page = parseInt(localStorage.emojiPage) || 0;
  const offset = parseInt(localStorage.emojiOffset) || 0;
  render(page, offset, options);

  $('body, textarea').on('keydown.emoji', e => {
    if (e.which === 27) {
      closeSelector();
      return false;
    }
  });
}

export { showSelector };
