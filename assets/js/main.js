/*
* 当前站点只使用新版 Memos API，主脚本只保留现有页面真正需要的功能：
* 拉取公开 memo、分页、Markdown/媒体渲染、资源展示、总数、相对时间和主题切换。
*/

var memo = {
    host: 'https://demo.usememos.com/',
    limit: '10',
    creatorId: '101',
    domId: '#memos',
    username: 'Admin',
    name: 'Administrator',
    language: 'en',
    total: true,
};

if (typeof memos !== 'undefined') {
    for (var key in memos) {
        if (memos[key]) {
            memo[key] = memos[key];
        }
    }
}

var apiBase = memo.host.replace(/\/$/, '');
var pageSize = Number.parseInt(memo.limit, 10) || 10;
var memoDom = document.querySelector(memo.domId);
var nextPageToken = '';

var TAG_REG = /#([^\s#]+?) /g;
var BILIBILI_REG = /<a\shref="https:\/\/www\.bilibili\.com\/video\/((av[\d]{1,10})|(BV([\w]{10})))\/?">.*<\/a>/g;
var NETEASE_MUSIC_REG = /<a\shref="https:\/\/music\.163\.com\/.*id=([0-9]+)".*?>.*<\/a>/g;
var QQMUSIC_REG = /<a\shref="https:\/\/y\.qq\.com\/.*(\/[0-9a-zA-Z]+)(\.html)?".*?>.*?<\/a>/g;
var QQVIDEO_REG = /<a\shref="https:\/\/v\.qq\.com\/.*\/([a-zA-Z0-9]+)\.html".*?>.*<\/a>/g;
var SPOTIFY_REG = /<a\shref="https:\/\/open\.spotify\.com\/(track|album)\/([\s\S]+)".*?>.*<\/a>/g;
var YOUKU_REG = /<a\shref="https:\/\/v\.youku\.com\/.*\/id_([a-zA-Z0-9=]+)\.html".*?>.*<\/a>/g;
var YOUTUBE_REG = /<a\shref="https:\/\/www\.youtube\.com\/watch\?v\=([a-zA-Z0-9]{11})\".*?>.*<\/a>/g;
var LOAD_BUTTON_HTML = '<button class="load-btn button-load">努力加载中……</button>';
var VERIFIED_ICON = '<svg viewBox="0 0 24 24" aria-label="认证账号" class="memos__verify"><g><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"></path></g></svg>';

initMemos();
initTotal();
initThemeToggle();

function initMemos() {
    if (!memoDom) {
        return;
    }

    var tagFilter = document.getElementById('tag-filter');
    if (tagFilter) {
        tagFilter.remove();
    }

    memoDom.insertAdjacentHTML('afterend', LOAD_BUTTON_HTML);

    var loadButton = document.querySelector('button.button-load');
    if (loadButton) {
        loadButton.addEventListener('click', loadMoreMemos);
    }

    loadInitialMemos();
}

async function fetchMemoPage(pageToken) {
    var memoUrl = apiBase + '/api/v1/memos?parent=users/' + memo.creatorId + '&pageSize=' + pageSize;

    if (pageToken) {
        memoUrl += '&pageToken=' + encodeURIComponent(pageToken);
    }

    var response = await fetch(memoUrl);
    if (!response.ok) {
        throw new Error('Failed to fetch memos: ' + response.status);
    }

    return response.json();
}

async function loadInitialMemos() {
    setLoadButtonText('努力加载中……');

    try {
        var response = await fetchMemoPage('');
        var items = response.memos || [];

        renderMemos(items);
        nextPageToken = response.nextPageToken || '';
        syncLoadButton(items.length);
    } catch (error) {
        console.error(error);
        setLoadButtonText('加载失败，请重试');
    }
}

async function loadMoreMemos() {
    if (!nextPageToken) {
        removeLoadButton();
        return;
    }

    setLoadButtonText('努力加载中……');

    try {
        var response = await fetchMemoPage(nextPageToken);
        var items = response.memos || [];

        renderMemos(items);
        nextPageToken = response.nextPageToken || '';
        syncLoadButton(items.length);
    } catch (error) {
        console.error(error);
        setLoadButtonText('加载失败，请重试');
    }
}

function syncLoadButton(itemCount) {
    if (!nextPageToken || itemCount < pageSize) {
        removeLoadButton();
        return;
    }

    setLoadButtonText('加载更多');
}

function setLoadButtonText(text) {
    var button = document.querySelector('button.button-load');
    if (button) {
        button.textContent = text;
    }
}

function removeLoadButton() {
    var button = document.querySelector('button.button-load');
    if (button) {
        button.remove();
    }
}

function renderMemos(items) {
    if (!items.length) {
        return;
    }

    var memoItems = items.map(function (item) {
        return buildMemoItem(item);
    }).join('');

    memoDom.insertAdjacentHTML('beforeend', '<ul>' + memoItems + '</ul>');
    window.ViewImage && ViewImage.init('.container img');
}

function buildMemoItem(item) {
    var memoId = getMemoId(item);
    var relativeTime = getRelativeTime(new Date(item.createTime));
    var avatarUrl = memo.host + 'api/v1/users/' + memo.creatorId + '/avatar';

    return '<li class="timeline"><div class="memos__content" style="--avatar-url: url(' + avatarUrl + ')"><div class="memos__text"><div class="memos__userinfo"><div>'
        + memo.name + '</div><div>' + VERIFIED_ICON + '</div><div class="memos__id">@' + memo.username + '</div></div><p>'
        + renderMemoContent(item.content || '') + renderResources(item)
        + '</p></div><div class="memos__meta"><small class="memos__date">' + relativeTime
        + ' • From「<a href="' + memo.host + 'm/' + memoId + '" target="_blank">Memos</a>」</small></div></div></li>';
}

function getMemoId(item) {
    return (item.name || '').split('/').pop() || item.uid || '';
}

function renderMemoContent(content) {
    return marked.parse(content.replace(TAG_REG, "<span class='tag-span'>#$1</span> "))
        .replace(BILIBILI_REG, "<div class='video-wrapper'><iframe src='//www.bilibili.com/blackboard/html5mobileplayer.html?bvid=$1&as_wide=1&high_quality=1&danmaku=0' scrolling='no' border='0' frameborder='no' framespacing='0' allowfullscreen='true' style='position:absolute;height:100%;width:100%;'></iframe></div>")
        .replace(YOUTUBE_REG, "<div class='video-wrapper'><iframe src='https://www.youtube.com/embed/$1' title='YouTube video player' frameborder='0' allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture' allowfullscreen></iframe></div>")
        .replace(NETEASE_MUSIC_REG, "<meting-js auto='https://music.163.com/#/song?id=$1'></meting-js>")
        .replace(QQMUSIC_REG, "<meting-js auto='https://y.qq.com/n/yqq/song$1.html'></meting-js>")
        .replace(QQVIDEO_REG, "<div class='video-wrapper'><iframe src='//v.qq.com/iframe/player.html?vid=$1' allowFullScreen='true' frameborder='no'></iframe></div>")
        .replace(SPOTIFY_REG, "<div class='spotify-wrapper'><iframe style='border-radius:12px' src='https://open.spotify.com/embed/$1/$2?utm_source=generator&theme=0' width='100%' frameBorder='0' allowfullscreen='' allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture' loading='lazy'></iframe></div>")
        .replace(YOUKU_REG, "<div class='video-wrapper'><iframe src='https://player.youku.com/embed/$1' frameborder='0' allowfullscreen></iframe></div>");
}

function renderResources(item) {
    var resources = item.resources || item.attachments || [];
    if (!resources.length) {
        return '';
    }

    var imageHtml = '';
    var fileHtml = '';

    for (var index = 0; index < resources.length; index++) {
        var resource = resources[index];
        var resourceType = ((resource.type || resource.mimeType || '').slice(0, 5)).toLowerCase();
        var externalLink = resource.externalLink || '';
        var filename = resource.filename || resource.name || '';
        var resourceName = resource.name || resource.filename || '';
        var resourceUrl = externalLink || (apiBase + '/file/' + resourceName + '/' + filename);

        if (resourceType === 'image') {
            imageHtml += '<div class="resimg" style="flex: 1 1 calc(33.33% - 10px); overflow: hidden; position: relative; height: 200px;">'
                + '<img loading="lazy" src="' + resourceUrl + '" style="width: 100%; height: 100%; object-fit: contain; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"/>'
                + '</div>';
        } else {
            fileHtml += '<a target="_blank" rel="noreferrer" href="' + resourceUrl + '">' + filename + '</a>';
        }
    }

    var html = '';
    if (imageHtml) {
        html += '<div class="resource-wrapper"><div class="images-wrapper" style="display: flex; flex-wrap: wrap; gap: 10px;">' + imageHtml + '</div></div>';
    }
    if (fileHtml) {
        html += '<div class="resource-wrapper"><p class="datasource">' + fileHtml + '</p></div>';
    }
    return html;
}

function initTotal() {
    if (memo.total !== true) {
        var totalDiv = document.querySelector('div.total');
        if (totalDiv) {
            totalDiv.remove();
        }
        return;
    }

    window.addEventListener('load', getTotal);
}

function getTotal() {
    fetch(apiBase + '/api/v1/users/' + memo.creatorId + ':getStats')
        .then(function (res) {
            return res.json();
        })
        .then(function (resdata) {
            if (resdata && resdata.totalMemoCount !== undefined) {
                var memosCount = document.getElementById('total');
                if (memosCount) {
                    memosCount.innerHTML = resdata.totalMemoCount;
                }
            }
        })
        .catch(function (err) {
            console.error('Error fetching memos:', err);
        });
}

function getRelativeTime(date) {
    var rtf = new Intl.RelativeTimeFormat(memo.language, { numeric: 'auto', style: 'short' });
    var now = new Date();
    var diff = now - date;
    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    var months = Math.floor(days / 30);
    var years = Math.floor(days / 365);

    if (years > 0) {
        return rtf.format(-years, 'year');
    }
    if (months > 0) {
        return rtf.format(-months, 'month');
    }
    if (days > 0) {
        return rtf.format(-days, 'day');
    }
    if (hours > 0) {
        return rtf.format(-hours, 'hour');
    }
    if (minutes > 0) {
        return rtf.format(-minutes, 'minute');
    }
    return rtf.format(-seconds, 'second');
}

function initThemeToggle() {
    var localTheme = window.localStorage && window.localStorage.getItem('theme');
    var themeToggle = document.querySelector('.theme-toggle');

    if (localTheme) {
        document.body.classList.remove('light-theme', 'dark-theme');
        document.body.classList.add(localTheme);
    }

    if (!themeToggle) {
        return;
    }

    themeToggle.addEventListener('click', function () {
        var themeUndefined = !new RegExp('(dark|light)-theme').test(document.body.className);
        var isOSDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (themeUndefined) {
            document.body.classList.add(isOSDark ? 'light-theme' : 'dark-theme');
        } else {
            document.body.classList.toggle('light-theme');
            document.body.classList.toggle('dark-theme');
        }

        if (window.localStorage) {
            window.localStorage.setItem(
                'theme',
                document.body.classList.contains('dark-theme') ? 'dark-theme' : 'light-theme'
            );
        }
    });
}
