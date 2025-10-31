# SoundCloud Theme Customization Guide

This file contains a comprehensive list of CSS selectors for SoundCloud, including both high-level components and specific, granular elements used for detailed theme creation.

## General & Global

- `body` - Main background of the entire page
- `#app .l-container.l-content` // NEW - Crucial for the main content area's background (the part that scrolls)
- `::-webkit-scrollbar` - The scrollbar track
- `::-webkit-scrollbar-thumb` - The scrollbar handle that you drag

## Header & Footer

- `.header` - Top navigation bar
- `.header__inner` - The container inside the header
- `.header__logo a.header__logoLink` // NEW - The actual clickable logo link, perfect for replacing the logo
- `.footer` - The footer section at the bottom of the page

## Sidebar & Navigation Tabs

- `.sidebar` - The entire left or right sidebar
- `.collectionNav` - The container for tabs like "Overview", "Likes", "Playlists"
- `.g-tabs` // NEW - A more general selector for tab containers
- `.g-tabs-item` - An individual tab
- `.g-tabs-link` - The clickable link within a tab

## Typography (NEW Section)

- `h1`, `h2`, `h3` // NEW - General page headers for bold styling
- `.soundTitle__title` // NEW - The main title of a track, very important
- `.playableTile__title` - The title on a smaller track/playlist card
- `.soundTitle__username` - Artist/Username link on a track page
- `.playableTile__username` // NEW - Artist/Username on a smaller card

## Track Items, Playable Tiles & Lists

- `.soundList__item`, `.trackItem` - Rows in a track list
- `.sound` - A main container for a single track on its own page
- `.sound__body` - The body of a track item
- `.sound__content` - The content area of a track item
- `.playableTile` - The main container for a square track/playlist/album card
- `.playableTile__artwork` - The artwork container on a square card
- `.playableTile .image` // NEW - The actual `<img>` tag wrapper inside the artwork, useful for animations
- `.playableTile__description` - Description on a square card

## User Badges & Profile Elements

- `.badgeList` - A container for multiple user cards (e.g., in "Following")
- `.userBadgeListItem` - A single user card in a list
- `.userBadgeListItem__artwork` - The user's avatar on the card
- `.userBadgeListItem__title` - The user's name on the card
- `.userBadgeListItem__subtitle` - The user's stats (followers, tracks)
- `.userBadgeListItem__action` - Container for the "Follow" button

## Mini-player (Play Controls Bar)

- `.playControls` - The entire bottom player bar
- `.playControls__inner` - Inner container
- `.playControls__wrapper` - Wrapper for elements
- `.playControls__elements` - Container for the controls
- `.playControl` // NEW - The main play/pause button (often a `<div>` wrapping the `<button>`)
- `.skipControl` - "Previous" and "Next" buttons
- `.shuffleControl` - Shuffle button
- `.repeatControl` - Repeat button
- `.playControls__volume` - Volume control area
- `.playbackSoundBadge` - The section on the left showing the current track
- `.playbackSoundBadge__artwork` // NEW - The artwork of the currently playing track in the player

### Progress Bar

- `.playbackTimeline` - The entire timeline container
- `.playbackTimeline__progressWrapper` // NEW - The background/track of the progress bar
- `.playbackTimeline__progressBar` // NEW - The filled-in (progress) part of the bar
- `.playbackTimeline__progressHandle` // NEW - The draggable handle/scrubber

## Waveform

- `.sound__waveform` - The container for the waveform on a track page
- `.waveform` - The waveform visualization itself
- `.waveformCommentsNode` // NEW - The layer for comments on top of the waveform, important to exclude from filters

## Action Buttons

- `.soundActions` - The toolbar for action buttons on a track
- `.playableTile__playButton` // NEW - The play button that appears over artwork
- `.sc-button-play`, `.sc-button-pause` - General play/pause buttons
- `.sc-button-like` - Like button
- `.sc-button-repost` - Repost button
- `.sc-button-share` - Share button
- `.sc-button-copylink` - Copy link button
- `.sc-button-more` - The "More" (...) button
- `.sc-button-medium.sc-button-icon` // NEW - Specifically targets action buttons with just an icon

## Comments & Input Fields

- `.commentForm__input` - The main comment input field

## Upload Page

- `.uploadMain` - The main container of the upload page
- `.uploadMain__chooserContainer` - The "drag and drop" area
- `.uploadMain__button` - The main "Choose files" button
- `.tabs__item` - An individual tab on the upload page (e.g., Basic Info)
