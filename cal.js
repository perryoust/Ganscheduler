כן(cl.city === city || !cl.city) && (cl.gardenIds || []).some(gid => cityEvs.some(s => s.g === parseInt(gid) && !firstUsedGids.has(s.g))));
dayClusters.forEach(cl => _renderCl(cl));
      }

cityEvs.filter(s => !firstUsedGids.has(s.g))
  .sort((a, b) => (window.G(a.g).name || '').localeCompare(window.G(b.g).name || '', 'he') || (a.t || '99:99').localeCompare(b.t || '99:99'))
  .forEach(s => { h += _listRow(s, clr, ds); });

h += `</div></details>`;
    });
h += '</div></div>';
  });
return h + '</div>';
}

// [Global Bridge moved to index.html final script tag]
