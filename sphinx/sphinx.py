import pygtk,gtk,gobject,sys
gobject.threads_init()
import gst

def result(asr, text, uttid): 
    print '>>>' + text
    sys.stdout.flush()


pipeline=gst.parse_launch('alsasrc ! audioconvert ! audioresample !' +
                            ' vader name=vad auto-threshold=true !' +
                            ' pocketsphinx lm=/home/pi/ehma/models/ehma.lm dict=/home/pi/ehma/models/ehma.dic name=asr !' +
                            ' appsink sync=false name=appsink')

asr=pipeline.get_by_name('asr')
asr.connect('result', result)
#asr.set_property('lm', '1.lm')
#asr.set_property('dict', '1.dic')
asr.set_property('configured', True)
pipeline.set_state(gst.STATE_PLAYING)
gtk.main()
