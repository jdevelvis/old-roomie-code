import pygtk,gtk,gobject,sys,os
gobject.threads_init()
import gst

def result(asr, text, uttid): 
    print '>>>' + text
    sys.stdout.flush()

def partial_result(asr, text, uttid): 
    print 'Partial: ' + text + "\n"
    sys.stdout.flush()


pipeline=gst.parse_launch('alsasrc ! audioconvert ! audioresample !' +
                            ' vader name=vad auto-threshold=true !' +
                            ' pocketsphinx name=asr !' +
                            ' appsink sync=false name=appsink')

asr=pipeline.get_by_name('asr')
asr.connect('result', result)
asr.connect('partial_result', partial_result)

#Get the parent directory so we can find the .lm and .dic files
cwd = os.path.dirname(os.path.realpath(__file__))
dir = cwd.split('/')
del dir[-1]
folder = '/'.join(dir)

asr.set_property('lm', folder + '/models/ehma.lm')
asr.set_property('dict', folder + '/models/ehma.dic')
asr.set_property('configured', True)
pipeline.set_state(gst.STATE_PLAYING)
gtk.main()
