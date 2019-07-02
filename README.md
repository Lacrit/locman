## Setup 

* Download your [credentials.json](https://developers.google.com/sheets/api/quickstart/nodejs) and place it in the root of your project.
* Create a file containing the spreadsheetID using **init** command. This ID is the value between the `/d/` and the `/edit` in the URL of your spreadsheet.

The *token.json* will be generated based on your credentials after the first request is made.

**Remember to add `./creadentials.json` to *.gitignore*.**

***

## Structure 

On the root of the project you need to have `public/locales` folder where you keep the language subfolders with json modules later used by intl.

It should have the following structure: 

``` 
...
└── public
    └── locales
        ├── langShortName1
        │   ├── module1.json
        │   ├── module2.json
        │   └── ...
        ├── langShortName2
        │   ├── module1.json
        │   ├── module2.json
        │   └── ...
        └── ...
```

### Assumptions

* There cannot be a key named 'key'

* You can`t add new languages after first push (not yet implemented*)

* Supports modules to be nested JSON's

***

## Usage

`node ./Localization/index.js command [-o|spreadsheetID]`

 - `-o` stands for *override*

***

## Commands

* **push** — *standardizes* local data, creates and deletes sheets if needed and *merges*/*overrides* the data with the spreasheet (takes an optional argument `-o`)
* **pull** — creates and deletes json modules if needed and *merges*/*overrides* the data locally (takes an optional argument `-o`)
* **init** — creates the file containing spreadsheetID (takes `spreasheetID` as an argument)
* **diff** — shows the difference between sheets and your local modules

***

## Standarization

* Adds missing keys if any, i.e. if the keys weren't added to every translation module
* Adds missing modules if any, i.e. if the modules weren't added to every language subfolder 

### Example 

![Example](Localization/pics/Standarization.png)

***

## Merge 

Incorporates row changes if there are no conflicts, otherwise allows to resolve each *conflict* individually.

### Example data

![Example](Localization/pics/Data.PNG)

_**Conflict**_ appears whenever the translation for the key, that exist both locally and in the spreadsheet, was changed.

### Example conflicts

![Example](Localization/pics/Conflicts.PNG)

***

## Override

Force pushing or pulling changes.

