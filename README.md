# WFM Seeker component v2

![this thing](resources/readme.png)

## Description

Fuzzy search React component from `warframe.market`  
This is *v2* of the component, it's a rewrite of the original component.

> :warning: This repository require a future setup, i just throw it togeter in 5 mins.

## How to use

```jsx
<Seeker
    placeholder={"placeholder"}
    autocompleteOnBlur={true}
    items={listOfItems}
    nameKey={`i18n.${currentLang}.name`}
    idKey={'id'}
    selectedItem={searchItem}
    onSelect={rememberSearch}
/>
```

### item model

```js
type ItemShort = {
    id: string;
    group: string;

    "i18n.en.name": string
    "i18n.ko.name": string
    "i18n.fr.name": string
    ...
};
```

Suggestions in dropdown list are sorted by group and then by number of matched chars, then alphabetically.

group named `top` will be always on top  
group named `bottom` always at bottom  
rest of groups will be sorted alphabetically  
