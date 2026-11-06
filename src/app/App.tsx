import { useEffect } from 'preact/hooks';
import { current, refreshLibrary } from './state';
import { Library } from './Library';
import { Editor } from './Editor';
import { UpdateToast } from './UpdateToast';

export function App() {
  useEffect(() => { void refreshLibrary(); }, []);
  return (
    <>
      {current.value ? <Editor /> : <Library />}
      <UpdateToast />
    </>
  );
}
