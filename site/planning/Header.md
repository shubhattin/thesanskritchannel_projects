# Header component

- It can start with icon on top. The icon is of the "The Sanskrit Channel". can be found at /public/icons/tsc_24.png and also 64.png
- This header can have three major sections, or atleast thats how I am thinking of it right now
- These are
  - Tools
  - Texts
  - Support Us
- I am thinking of using a navigation-bar of shadcn to implement this part. This is not strict and can evolve based on conditions and needs, but right now this seems to be the thing we need
- Also on mobile devices this had to some kind of menu structure or something, explore methods to present this one on mobile
- I am describing in more detail on what each section is and will/shall be

# Tools

- These are the tools that are developed by the team to help for various aspects of Sanskrit Learning and Exploration
- I am listing the different tools here

## Padavali

- Its a Sanskrit Word Game which can be played in multiple Indian Scripts
- Link : https://krida.thesanskritchannel.org/padavali

## Svara Darshini

- Its a tool to visualize your pitch levels and practice to improve them
- Helpful in getting the vedic svara sthanas used for chanting vedic mantras.
- Link : https://svara.thesanskritchannel.org/

## Akshara

- Akshara is a platform where you can learn, practice how to write, read Indian Scripts
- Its an interactive lesson where you draw it yourself on a board and learn.
- Supports multiple Indian Scripts
- Link : https://akshara.thesanskritchannel.org/

## Lipi Lekhika

- Lipi Lekhika is a script transliteration tool.
- It can be used to convert text from one Indian Script to another
- Link : https://lipilekhika.in/

So in the header under the tools section It would be good to have links of each of these tools and brief, good short description of these.

- And abviosuly everythign should be responsive to different screen sizes, on smaller screen sizes we could change how the description for each of these is displayed or we could even skip it if at all needed.
- Some shadcn component or method can help us make this type of UI to be accessible to even mobile users

# Texts

- This section basically contains the content which the current one serves too.
- More broabdly in the `project_list.ts` file basically. This is one of the core part of ths site which has been implemented fucntionality wise but needs much more polishing on the UI/UX side
- Ok so here basically render the list of available texts and redirect them to thier links. This would the same as the current home page is, like display the names in english and devanagari and just redirect them to thier corresponding pages
- This is a dynamic field and values dont have to be hardcoded here, so some special care/attention has to go into this to make sure that the Ui remians consistent

# Support Us

- This one is basically a route which will be addeed (support_us.astro) in which you have what the channel does and why should you support it.
- You can get the links from an already implemented Support Us component in `SupportOptions.svelte` also the icons are also available for things like Razorpay, youtube , etc in $app/componenets/icon
- As here the ../app/src/_ is aliased to $app/_ for sharing the common resources and code from the sveltekit app codebase
- So this should just redirect to the link
- For icons you also have svelte-icons-pack and lucide icons library

# Theme Switcher on the top right

- I am also thinking og having a simple Theme switcher using some shadcn components. It has three modes as defined in RootLayout.astro
- On mobile it might be tucked into the menu, but for now lets just leave it in the top right corner, we could just make it smaller if needed

---

- And the same goes for this one too
- Load it with a cleint:idle directive
- and include it in the RootLayout file
