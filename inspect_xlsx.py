import xml.etree.ElementTree as ET
import sys

def get_strings():
    try:
        context = ET.iterparse('temp_xlsx/xl/sharedStrings.xml', events=('end',))
        count = 0
        for event, elem in context:
            if elem.tag.endswith('t'):
                print(f"{count}: {elem.text}")
                count += 1
                if count > 100:
                    break
            # Clear element to save memory
            elem.clear()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_strings()
