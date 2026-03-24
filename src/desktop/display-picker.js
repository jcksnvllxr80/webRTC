function createSection(title, sources) {
    const section = document.createElement('section');
    section.className = 'section';

    const heading = document.createElement('h2');
    heading.textContent = title;
    section.appendChild(heading);

    if (!sources.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = `No ${title.toLowerCase()} available.`;
        section.appendChild(empty);
        return section;
    }

    const grid = document.createElement('div');
    grid.className = 'grid';

    sources.forEach((source) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'card';
        button.addEventListener('click', () => {
            window.displayPickerAPI.selectSource(source.id);
        });

        const thumb = document.createElement('img');
        thumb.className = 'thumb';
        thumb.alt = source.name;
        if (source.thumbnailDataUrl) {
            thumb.src = source.thumbnailDataUrl;
        }
        button.appendChild(thumb);

        const meta = document.createElement('div');
        meta.className = 'meta';

        const metaTop = document.createElement('div');
        metaTop.className = 'meta-top';

        if (source.appIconDataUrl) {
            const icon = document.createElement('img');
            icon.className = 'icon';
            icon.alt = '';
            icon.src = source.appIconDataUrl;
            metaTop.appendChild(icon);
        }

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = source.name;
        metaTop.appendChild(name);
        meta.appendChild(metaTop);

        const kind = document.createElement('div');
        kind.className = 'kind';
        kind.textContent = source.kind === 'screen' ? 'Entire screen' : 'Application window';
        meta.appendChild(kind);

        button.appendChild(meta);
        grid.appendChild(button);
    });

    section.appendChild(grid);
    return section;
}

window.displayPickerAPI.onSources((sources) => {
    const content = document.getElementById('content');
    content.innerHTML = '';

    const screens = sources.filter((source) => source.kind === 'screen');
    const windows = sources.filter((source) => source.kind === 'window');

    content.appendChild(createSection('Screens', screens));
    content.appendChild(createSection('Windows', windows));
});

document.getElementById('cancel-btn').addEventListener('click', () => {
    window.displayPickerAPI.cancel();
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        window.displayPickerAPI.cancel();
    }
});
