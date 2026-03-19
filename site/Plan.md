# Site implementation

- While the main (app) is more focused on managing and admin control, editing and that kind of stuff, while on the other hand this astro project we will be working on will serve as a more user friendly static site interface rather than a full blown complex svelte app whose complexity they anyways dont need

## Previous route structure

- The previous route structure depends on a few things (src/state/project_list.ts). Which is basically the project map structure and the location of the elements in the tree structure of map json files defined in each project.
- For eg :- for Valmiki Ramayanama key is "ramayanamam" for for first kanda and first sarga it would be /ramayanam/1/1. This mechanism works by capturing all routes in svelte
- In astro also it will be the same but with more user ergonisms and user firendly links.
- So there will be two stages of implementation, the first stage shall be implemented right away but the second part will need some more brainstorming
- **Main route implemetation**
- The old /{key}/_ structure woold remain but the the _ part will now be like /{key}/{level-name}-{num} <recursive> instead of the admin apps /{key}/{num} <recursive based on the tree/branch depth of the project in that particular subtree>
- Ok so thats one basic criterai now comming to the level name part, its basically the the lowercase level name like kanada, sarga for key ramayanam. these levels can be very well found in proper nested structures whose type is also defined (in zod). Also helper fucntions are available project_list.ts to help out with this part.

### Other ergonomics

- So while the final one does shows the "text" fetched when it reaches a leaf node in the tree like the prexisign workflows for data fetching
- You should use the common parts from the "apps" codebase, a alias $app has been made in the site/tsconfig.json to help access the resources of the main app's code, this shall prevent duplication, and also we can use those files as in prod and dev too they will share both the database's and redis API keys to fetch the data from so its fine to use the utilities for server side data fetching.
- The same goes for app too like in the root svelte.config.js we also have an alias for $site to access astro site content from the app if ever needed

### Intermediate pages

- While till now on the admin app page we had the list of subroutes displayed as a list in the <Select> component and load it dynamically when selected in this astro app we shall instead link it is href to an actual page rendered as list of links

### Design and fucntionality

- We will be adding more fancy features like a Header, Footer and other such things later on, but right now our main focus is to get the main app up in running with the core feature which is to be able to load and display the text data with proper list format handling the nesting things properly and such
- A good home page and other such things will evetually indeed come but for now lets focus on the functionality part

## Implementation Start

- So for the path like /{key}/\* it shall take that input and try to verify if matches the level name and number is within bounds based on the project map of that particular key.
- Write some tests (vitest) to test this function in isolation
- Moreover we will also want a feature where if we navigate with the the admin apps url strcuture we should be redirected to the site's url structure of /{key}/{level-name-lower}-{num}_ if comming from a /{key}/{num}_, the verfieciation regarding the {num} exisitn of course shall be done here too and if not found then it shall a 404 page (make a astro 404 page, simple for now we will improve it later).
- Implement and test these independent functions in site/src/utils/ and then use them in astro files for dynamic routing, reditrection, etc.

### The future feature I have been talking about

- We could just even ignore this part at this phase but still I think we can consider it anyway, this might reduce the amount of work we would have to do in the future if we preplan
- So my plan is to solve the problem where we end with pretty long links like for vedas where its like in some cases 4-5 levels deep due to extra intrduction levels of things like shakas, samhitas, etc.
- Anyway so the general outline is
- For a final url of this form /{key}/\* there can exist can a exsist a mapping where the final destination instead is the new shorthand (substitute).
- Now the how will this substinitute be stored, retrievd and cached is a future matter. Also how exactly will it be mapped and what information shall be stored for that and in which format shall it be stored will be decided later.
- For now we can just a empty function as a placeholder for this to be implmented in future. it shall take the final url form (string) and then return null (current behavior), in future this will return a string and in that case this particular url will be used to get the final resolved url, i.e. if it comes to /{key}/level-num* then it will go to the substitued url. This will also handle like multi level redirects like /{key}/num* -> {key}/level-num\* -> substitibe, and this substituted url will the actual thing that shall be also embedded in the href tags on html pages (just to avoid the unncessary redirect).
- And yeah this would also mean in that catch all routes pattern we will also have to account for the substitided url structire, so for now do not make any change in that part as the structure and matching algorithm has not yet been deciced for that part yet, so lets that out for now. Moreover this substitute url feature might not even get implemented in the end so lets only add the bare minimum forn now

## Tools Libraries to use

- Use bun as a package manager for both of them.
- Shadcn components are installed for the site/\* app, you can see the ones available and add more with `bun x shadcn-svelte@latest add <comp>` command as per th need
