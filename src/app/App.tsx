import { useEffect } from 'preact/hooks';
import { current, library, newFromTemplate, openProject, refreshLibrary } from './state';
import { Library } from './Library';
import { Editor } from './Editor';
import { UpdateToast } from './UpdateToast';

const PREVIEW_NAME = 'Editor preview';

export function App() {
  useEffect(() => {
    void (async () => {
      await refreshLibrary();
      // Direct link to the editor for design review: ?view=editor[&template=logo|lower-third|kinetic|loader]
      const q = new URLSearchParams(location.search);
      if (q.get('view') !== 'editor') return;
      const tpl = q.get('template') ?? 'logo';
      const existing = library.value.find((m) => m.name === PREVIEW_NAME);
      if (existing) await openProject(existing.id);
      else await newFromTemplate(tpl, PREVIEW_NAME);
    })();
  }, []);
  return (
    <>
      {current.value ? <Editor /> : <Library />}
      <UpdateToast />
    </>
  );
}
